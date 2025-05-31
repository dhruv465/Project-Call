/**
 * Lead Service - Handles database operations for leads
 */
import { ILead } from '../models/Lead';
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
export declare class LeadService {
    /**
     * Create a new lead
     */
    createLead(leadData: Partial<ILead>): Promise<ILead>;
    /**
     * Get a lead by ID
     */
    getLeadById(id: string): Promise<ILead | null>;
    /**
     * Get a lead by phone number
     */
    getLeadByPhoneNumber(phoneNumber: string): Promise<ILead | null>;
    /**
     * Update a lead
     */
    updateLead(id: string, updateData: LeadUpdateData): Promise<ILead | null>;
    /**
     * Delete a lead
     */
    deleteLead(id: string): Promise<boolean>;
    /**
     * Get leads with filtering
     */
    getLeads(filter?: LeadFilter, page?: number, limit?: number, sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<{
        leads: ILead[];
        total: number;
        pages: number;
    }>;
    /**
     * Get leads for calling campaign
     */
    getLeadsForCalling(count?: number, languagePreference?: string, excludeIds?: string[]): Promise<ILead[]>;
    /**
     * Update lead after call
     */
    updateLeadAfterCall(id: string, status: string, notes?: string, callbackDate?: Date): Promise<ILead | null>;
}
declare const _default: LeadService;
export default _default;
