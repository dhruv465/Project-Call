/**
 * Types for the telephony service
 */
export type TwilioCallStatus = 'queued' | 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed' | 'no-answer' | 'canceled';
export interface RecordingData {
    id: string;
    duration: number;
    url: string;
    status: 'completed' | 'processing' | 'failed';
}
export interface CallData {
    id: string;
    to?: string;
    from?: string;
    status: TwilioCallStatus;
    startTime: string;
    endTime?: string;
    duration?: number;
    recordings: RecordingData[];
    transcript?: string;
    analysis?: any;
    isFallback?: boolean;
}
export interface TelephonyEvent {
    type: 'status-change' | 'recording-available' | 'transcription-available';
    callId: string;
    data: any;
}
export interface TelephonyServiceInterface {
    makeCall(to: string, from: string, callbackUrl: string, options?: {
        timeout?: number;
        machineDetection?: 'Enable' | 'DetectMessageEnd';
        recordingEnabled?: boolean;
    }): Promise<string>;
    endCall(callId: string): Promise<boolean>;
    handleWebhook(eventType: string, data: any): void;
    getCallData(callId: string): CallData | undefined;
    on(eventName: string, listener: (event: TelephonyEvent) => void): void;
    checkHealth(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        message?: string;
    }>;
}
