/**
 * Campaign Service - Handles campaign execution and A/B testing
 */
export interface CampaignVariant {
    id: string;
    name: string;
    personality: string;
    script: string;
    language: 'English' | 'Hindi';
    isControl?: boolean;
}
export interface Campaign {
    id: string;
    name: string;
    description: string;
    status: 'draft' | 'active' | 'paused' | 'completed';
    targetCount: number;
    currentCount: number;
    startDate?: Date;
    endDate?: Date;
    leadFilters: {
        status?: string[];
        source?: string[];
        tags?: string[];
        languagePreference?: string[];
    };
    variants: CampaignVariant[];
    metrics: {
        totalCalls: number;
        completedCalls: number;
        failedCalls: number;
        positiveEmotions: number;
        negativeEmotions: number;
        averageCallDuration: number;
        conversionRate: number;
        variantPerformance: {
            [variantId: string]: {
                calls: number;
                completions: number;
                positiveEmotions: number;
                conversionRate: number;
            };
        };
    };
    callRecords: string[];
}
export interface CallRecord {
    id: string;
    campaignId: string;
    leadId: string;
    variantId: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    status: 'in-progress' | 'completed' | 'failed' | 'no-answer';
    emotions: {
        primary: string;
        trends: string;
        finalScore: number;
    };
    outcome: string;
    notes?: string;
    transcriptPath?: string;
    recordingPath?: string;
}
export declare class CampaignService {
    private campaigns;
    private callRecords;
    private conversationEngine;
    constructor(elevenLabsApiKey: string, openAIApiKey: string, anthropicApiKey?: string, googleSpeechKey?: string);
    /**
     * Create a new campaign
     */
    createCampaign(campaignData: Partial<Campaign>): Campaign;
    /**
     * Get a campaign by ID
     */
    getCampaign(id: string): Campaign | undefined;
    /**
     * Get all campaigns
     */
    getAllCampaigns(): Campaign[];
    /**
     * Update a campaign
     */
    updateCampaign(id: string, updateData: Partial<Campaign>): Campaign | undefined;
    /**
     * Delete a campaign
     */
    deleteCampaign(id: string): boolean;
    /**
     * Start a campaign
     */
    startCampaign(id: string): Campaign | undefined;
    /**
     * Pause a campaign
     */
    pauseCampaign(id: string): Campaign | undefined;
    /**
     * Complete a campaign
     */
    completeCampaign(id: string): Campaign | undefined;
    /**
     * Process campaign by making calls
     */
    private processCampaign;
    /**
     * Select a variant for A/B testing
     */
    private selectVariant;
    /**
     * Complete a call and update metrics
     */
    completeCall(callRecordId: string, status: 'completed' | 'failed' | 'no-answer', primaryEmotion?: string, emotionScore?: number, outcome?: string, notes?: string): CallRecord | undefined;
    /**
     * Update lead status after call
     */
    private updateLeadAfterCall;
    /**
     * Get call record by ID
     */
    getCallRecord(id: string): CallRecord | undefined;
    /**
     * Get call records for a campaign
     */
    getCallRecordsForCampaign(campaignId: string): CallRecord[];
    /**
     * Get call records for a lead
     */
    getCallRecordsForLead(leadId: string): CallRecord[];
    /**
     * Get campaign performance report
     */
    getCampaignPerformanceReport(campaignId: string): any;
}
export default CampaignService;
