/**
 * realTelephonyService.ts
 * Production implementation of the telephony service using Twilio
 */
import { TwilioCallStatus, CallData, TelephonyServiceInterface } from '../types/telephony';
export declare class RealTelephonyService implements TelephonyServiceInterface {
    private client;
    private events;
    private activeCalls;
    private webhookBaseUrl;
    private fallbackMode;
    constructor(accountSid: string, authToken: string, webhookBaseUrl: string);
    /**
     * Initiates an outbound call
     */
    makeCall(to: string, from: string, callbackUrl: string, options?: {
        timeout?: number;
        machineDetection?: 'Enable' | 'DetectMessageEnd';
        recordingEnabled?: boolean;
    }): Promise<string>;
    /**
     * Ends an active call
     */
    endCall(callId: string): Promise<boolean>;
    /**
     * Handles incoming webhook for call status changes
     */
    handleWebhook(eventType: string, data: any): void;
    /**
     * Updates call status based on webhook data
     */
    private handleCallStatusChange;
    /**
     * Updates recording information for a call
     */
    private handleRecordingUpdate;
    /**
     * Gets current status of a call
     */
    getCallStatus(callId: string): TwilioCallStatus | null;
    /**
     * Gets data for a specific call
     */
    getCallData(callId: string): CallData | null;
    /**
     * Retrieves all active calls
     */
    getActiveCalls(): CallData[];
    /**
     * Subscribes to telephony events
     */
    on(event: string, listener: (...args: any[]) => void): void;
    /**
     * Unsubscribes from telephony events
     */
    off(event: string, listener: (...args: any[]) => void): void;
    /**
     * Monitors Twilio API health and toggles fallback mode
     */
    private monitorApiHealth;
    /**
     * Check service health
     */
    checkHealth(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        message?: string;
    }>;
}
export interface TelephonyConfig {
    accountSid: string;
    authToken: string;
    webhookBaseUrl: string;
}
export declare function initializeTelephonyService(config: TelephonyConfig): RealTelephonyService;
export declare function getTelephonyService(): RealTelephonyService;
declare const _default: {
    initialize: typeof initializeTelephonyService;
    getService: typeof getTelephonyService;
};
export default _default;
