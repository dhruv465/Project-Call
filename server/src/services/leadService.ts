/**
 * Lead Service - Handles database operations for leads
 */

import Lead, { ILead } from '../models/Lead';
import { logger, getErrorMessage } from '../index';
import mongoose from 'mongoose';

export interface LeadFilter {
  status?: string;
  source?: string;
  tags?: string[];
  languagePreference?: string;
  lastContactedBefore?: Date;
  lastContactedAfter?: Date;
}

export interface LeadUpdateData {
  name?: string;
  email?: string;
  phoneNumber?: string;
  company?: string;
  title?: string;
  source?: string;
  languagePreference?: string;
  status?: string;
  notes?: string;
  tags?: string[];
  lastContacted?: Date;
  callCount?: number;
}

export class LeadService {
  /**
   * Create a new lead
   */
  public async createLead(leadData: Partial<ILead>): Promise<ILead> {
    try {
      logger.info(`Creating new lead: ${leadData.name}`);
      const lead = await Lead.create(leadData);
      return lead;
    } catch (error) {
      logger.error(`Error creating lead: ${getErrorMessage(error)}`);
      throw new Error(`Failed to create lead: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get a lead by ID
   */
  public async getLeadById(id: string): Promise<ILead | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid lead ID format');
      }
      
      const lead = await Lead.findById(id);
      return lead;
    } catch (error) {
      logger.error(`Error fetching lead by ID: ${getErrorMessage(error)}`);
      throw new Error(`Failed to fetch lead: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get a lead by phone number
   */
  public async getLeadByPhoneNumber(phoneNumber: string): Promise<ILead | null> {
    try {
      const lead = await Lead.findOne({ phoneNumber });
      return lead;
    } catch (error) {
      logger.error(`Error fetching lead by phone number: ${getErrorMessage(error)}`);
      throw new Error(`Failed to fetch lead: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Update a lead
   */
  public async updateLead(id: string, updateData: LeadUpdateData): Promise<ILead | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid lead ID format');
      }
      
      const lead = await Lead.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );
      
      logger.info(`Updated lead: ${id}`);
      return lead;
    } catch (error) {
      logger.error(`Error updating lead: ${getErrorMessage(error)}`);
      throw new Error(`Failed to update lead: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Delete a lead
   */
  public async deleteLead(id: string): Promise<boolean> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid lead ID format');
      }
      
      const result = await Lead.findByIdAndDelete(id);
      
      if (!result) {
        return false;
      }
      
      logger.info(`Deleted lead: ${id}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting lead: ${getErrorMessage(error)}`);
      throw new Error(`Failed to delete lead: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get leads with filtering
   */
  public async getLeads(
    filter: LeadFilter = {}, 
    page: number = 1, 
    limit: number = 20,
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<{ leads: ILead[]; total: number; pages: number }> {
    try {
      const query: any = {};
      
      // Apply filters
      if (filter.status) {
        query.status = filter.status;
      }
      
      if (filter.source) {
        query.source = filter.source;
      }
      
      if (filter.tags && filter.tags.length > 0) {
        query.tags = { $in: filter.tags };
      }
      
      if (filter.languagePreference) {
        query.languagePreference = filter.languagePreference;
      }
      
      // Date range filters
      if (filter.lastContactedBefore || filter.lastContactedAfter) {
        query.lastContacted = {};
        
        if (filter.lastContactedBefore) {
          query.lastContacted.$lte = filter.lastContactedBefore;
        }
        
        if (filter.lastContactedAfter) {
          query.lastContacted.$gte = filter.lastContactedAfter;
        }
      }
      
      // Calculate pagination
      const skip = (page - 1) * limit;
      
      // Prepare sort object
      const sort: any = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
      
      // Execute query with pagination
      const leads = await Lead.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit);
      
      // Get total count for pagination
      const total = await Lead.countDocuments(query);
      
      // Calculate total pages
      const pages = Math.ceil(total / limit);
      
      return { leads, total, pages };
    } catch (error) {
      logger.error(`Error fetching leads: ${getErrorMessage(error)}`);
      throw new Error(`Failed to fetch leads: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get leads for calling campaign
   */
  public async getLeadsForCalling(
    count: number = 10,
    languagePreference?: string,
    excludeIds: string[] = []
  ): Promise<ILead[]> {
    try {
      const query: any = {
        status: { $in: ['New', 'Contacted', 'Scheduled Callback'] }
      };
      
      // Add language filter if specified
      if (languagePreference) {
        query.languagePreference = languagePreference;
      }
      
      // Exclude specific leads
      if (excludeIds.length > 0) {
        const validIds = excludeIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validIds.length > 0) {
          query._id = { $nin: validIds.map(id => new mongoose.Types.ObjectId(id)) };
        }
      }
      
      // Prioritize:
      // 1. Scheduled callbacks that are due
      // 2. New leads
      // 3. Contacted leads with the least number of calls
      
      // First, get scheduled callbacks that are due
      const now = new Date();
      const scheduledCallbacks = await Lead.find({
        ...query,
        status: 'Scheduled Callback',
        lastContacted: { $lte: now }
      })
      .limit(count)
      .sort({ lastContacted: 1 });
      
      // If we have enough scheduled callbacks, return them
      if (scheduledCallbacks.length >= count) {
        return scheduledCallbacks;
      }
      
      // Otherwise, get new leads
      const newLeadsCount = count - scheduledCallbacks.length;
      const newLeads = await Lead.find({
        ...query,
        status: 'New'
      })
      .limit(newLeadsCount)
      .sort({ createdAt: 1 });
      
      // If we have enough leads with scheduled callbacks and new leads, return them
      if (scheduledCallbacks.length + newLeads.length >= count) {
        return [...scheduledCallbacks, ...newLeads];
      }
      
      // Otherwise, get contacted leads with the least number of calls
      const contactedLeadsCount = count - scheduledCallbacks.length - newLeads.length;
      const contactedLeads = await Lead.find({
        ...query,
        status: 'Contacted'
      })
      .limit(contactedLeadsCount)
      .sort({ callCount: 1, lastContacted: 1 });
      
      return [...scheduledCallbacks, ...newLeads, ...contactedLeads];
    } catch (error) {
      logger.error(`Error fetching leads for calling: ${getErrorMessage(error)}`);
      throw new Error(`Failed to fetch leads for calling: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Update lead after call
   */
  public async updateLeadAfterCall(
    id: string,
    status: string,
    notes?: string,
    callbackDate?: Date
  ): Promise<ILead | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid lead ID format');
      }
      
      const updateData: any = {
        status,
        lastContacted: new Date(),
        $inc: { callCount: 1 }
      };
      
      if (notes) {
        updateData.notes = notes;
      }
      
      // If status is scheduled callback, set callback date
      if (status === 'Scheduled Callback' && callbackDate) {
        updateData.callbackDate = callbackDate;
      }
      
      const lead = await Lead.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );
      
      logger.info(`Updated lead after call: ${id}, new status: ${status}`);
      return lead;
    } catch (error) {
      logger.error(`Error updating lead after call: ${getErrorMessage(error)}`);
      throw new Error(`Failed to update lead after call: ${getErrorMessage(error)}`);
    }
  }
}

export default new LeadService();
