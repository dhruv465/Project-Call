"use strict";
/**
 * Lead Service - Handles database operations for leads
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadService = void 0;
const Lead_1 = __importDefault(require("../models/Lead"));
const index_1 = require("../index");
const mongoose_1 = __importDefault(require("mongoose"));
class LeadService {
    /**
     * Create a new lead
     */
    async createLead(leadData) {
        try {
            index_1.logger.info(`Creating new lead: ${leadData.name}`);
            const lead = await Lead_1.default.create(leadData);
            return lead;
        }
        catch (error) {
            index_1.logger.error(`Error creating lead: ${(0, index_1.getErrorMessage)(error)}`);
            throw new Error(`Failed to create lead: ${(0, index_1.getErrorMessage)(error)}`);
        }
    }
    /**
     * Get a lead by ID
     */
    async getLeadById(id) {
        try {
            if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
                throw new Error('Invalid lead ID format');
            }
            const lead = await Lead_1.default.findById(id);
            return lead;
        }
        catch (error) {
            index_1.logger.error(`Error fetching lead by ID: ${(0, index_1.getErrorMessage)(error)}`);
            throw new Error(`Failed to fetch lead: ${(0, index_1.getErrorMessage)(error)}`);
        }
    }
    /**
     * Get a lead by phone number
     */
    async getLeadByPhoneNumber(phoneNumber) {
        try {
            const lead = await Lead_1.default.findOne({ phoneNumber });
            return lead;
        }
        catch (error) {
            index_1.logger.error(`Error fetching lead by phone number: ${(0, index_1.getErrorMessage)(error)}`);
            throw new Error(`Failed to fetch lead: ${(0, index_1.getErrorMessage)(error)}`);
        }
    }
    /**
     * Update a lead
     */
    async updateLead(id, updateData) {
        try {
            if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
                throw new Error('Invalid lead ID format');
            }
            const lead = await Lead_1.default.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
            index_1.logger.info(`Updated lead: ${id}`);
            return lead;
        }
        catch (error) {
            index_1.logger.error(`Error updating lead: ${(0, index_1.getErrorMessage)(error)}`);
            throw new Error(`Failed to update lead: ${(0, index_1.getErrorMessage)(error)}`);
        }
    }
    /**
     * Delete a lead
     */
    async deleteLead(id) {
        try {
            if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
                throw new Error('Invalid lead ID format');
            }
            const result = await Lead_1.default.findByIdAndDelete(id);
            if (!result) {
                return false;
            }
            index_1.logger.info(`Deleted lead: ${id}`);
            return true;
        }
        catch (error) {
            index_1.logger.error(`Error deleting lead: ${(0, index_1.getErrorMessage)(error)}`);
            throw new Error(`Failed to delete lead: ${(0, index_1.getErrorMessage)(error)}`);
        }
    }
    /**
     * Get leads with filtering
     */
    async getLeads(filter = {}, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc') {
        try {
            const query = {};
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
            const sort = {};
            sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
            // Execute query with pagination
            const leads = await Lead_1.default.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limit);
            // Get total count for pagination
            const total = await Lead_1.default.countDocuments(query);
            // Calculate total pages
            const pages = Math.ceil(total / limit);
            return { leads, total, pages };
        }
        catch (error) {
            index_1.logger.error(`Error fetching leads: ${(0, index_1.getErrorMessage)(error)}`);
            throw new Error(`Failed to fetch leads: ${(0, index_1.getErrorMessage)(error)}`);
        }
    }
    /**
     * Get leads for calling campaign
     */
    async getLeadsForCalling(count = 10, languagePreference, excludeIds = []) {
        try {
            const query = {
                status: { $in: ['New', 'Contacted', 'Scheduled Callback'] }
            };
            // Add language filter if specified
            if (languagePreference) {
                query.languagePreference = languagePreference;
            }
            // Exclude specific leads
            if (excludeIds.length > 0) {
                const validIds = excludeIds.filter(id => mongoose_1.default.Types.ObjectId.isValid(id));
                if (validIds.length > 0) {
                    query._id = { $nin: validIds.map(id => new mongoose_1.default.Types.ObjectId(id)) };
                }
            }
            // Prioritize:
            // 1. Scheduled callbacks that are due
            // 2. New leads
            // 3. Contacted leads with the least number of calls
            // First, get scheduled callbacks that are due
            const now = new Date();
            const scheduledCallbacks = await Lead_1.default.find({
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
            const newLeads = await Lead_1.default.find({
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
            const contactedLeads = await Lead_1.default.find({
                ...query,
                status: 'Contacted'
            })
                .limit(contactedLeadsCount)
                .sort({ callCount: 1, lastContacted: 1 });
            return [...scheduledCallbacks, ...newLeads, ...contactedLeads];
        }
        catch (error) {
            index_1.logger.error(`Error fetching leads for calling: ${(0, index_1.getErrorMessage)(error)}`);
            throw new Error(`Failed to fetch leads for calling: ${(0, index_1.getErrorMessage)(error)}`);
        }
    }
    /**
     * Update lead after call
     */
    async updateLeadAfterCall(id, status, notes, callbackDate) {
        try {
            if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
                throw new Error('Invalid lead ID format');
            }
            const updateData = {
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
            const lead = await Lead_1.default.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
            index_1.logger.info(`Updated lead after call: ${id}, new status: ${status}`);
            return lead;
        }
        catch (error) {
            index_1.logger.error(`Error updating lead after call: ${(0, index_1.getErrorMessage)(error)}`);
            throw new Error(`Failed to update lead after call: ${(0, index_1.getErrorMessage)(error)}`);
        }
    }
}
exports.LeadService = LeadService;
exports.default = new LeadService();
//# sourceMappingURL=leadService.js.map