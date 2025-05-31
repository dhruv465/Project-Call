"use strict";
/**
 * realTelephonyService.ts
 * Production implementation of the telephony service using Twilio
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealTelephonyService = void 0;
exports.initializeTelephonyService = initializeTelephonyService;
exports.getTelephonyService = getTelephonyService;
const twilio_1 = __importDefault(require("twilio"));
const events_1 = require("events");
const logger_1 = __importStar(require("../utils/logger"));
class RealTelephonyService {
    constructor(accountSid, authToken, webhookBaseUrl) {
        this.fallbackMode = false;
        // Initialize Twilio client
        this.client = (0, twilio_1.default)(accountSid, authToken);
        this.events = new events_1.EventEmitter();
        this.activeCalls = new Map();
        this.webhookBaseUrl = webhookBaseUrl;
        // Monitor Twilio API health
        this.monitorApiHealth();
    }
    /**
     * Initiates an outbound call
     */
    async makeCall(to, from, callbackUrl, options) {
        try {
            if (this.fallbackMode) {
                throw new Error('Telephony service is in fallback mode. Using simulated call.');
            }
            // Configure call parameters
            const callParams = {
                to,
                from,
                url: callbackUrl,
                statusCallback: `${this.webhookBaseUrl}/call-status`,
                statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
                statusCallbackMethod: 'POST',
            };
            // Add optional parameters
            if (options?.timeout) {
                callParams.timeout = options.timeout;
            }
            if (options?.machineDetection) {
                callParams.machineDetection = options.machineDetection;
            }
            if (options?.recordingEnabled) {
                callParams.record = true;
                callParams.recordingStatusCallback = `${this.webhookBaseUrl}/recording-status`;
            }
            // Place the call
            const call = await this.client.calls.create(callParams);
            // Store call data
            this.activeCalls.set(call.sid, {
                id: call.sid,
                to,
                from,
                status: call.status,
                startTime: new Date().toISOString(),
                recordings: []
            });
            logger_1.default.info(`Call initiated: ${call.sid} to ${to} from ${from}`);
            return call.sid;
        }
        catch (error) {
            logger_1.default.error(`Error making call: ${(0, logger_1.getErrorMessage)(error)}`, { error });
            // Use fallback mode if we're not already in it
            if (!this.fallbackMode) {
                this.fallbackMode = true;
                logger_1.default.warn('Switching to fallback telephony mode');
                // Use simulated call (fallback logic)
                const simulatedCallId = `sim_${Date.now()}`;
                this.activeCalls.set(simulatedCallId, {
                    id: simulatedCallId,
                    to,
                    from,
                    status: 'initiated',
                    startTime: new Date().toISOString(),
                    recordings: [],
                    isFallback: true
                });
                // Simulate call progress events
                setTimeout(() => this.handleCallStatusChange(simulatedCallId, 'ringing'), 1000);
                setTimeout(() => this.handleCallStatusChange(simulatedCallId, 'in-progress'), 3000);
                return simulatedCallId;
            }
            throw error;
        }
    }
    /**
     * Ends an active call
     */
    async endCall(callId) {
        try {
            if (!this.activeCalls.has(callId)) {
                logger_1.default.warn(`Call ${callId} not found in active calls`);
                return false;
            }
            const callData = this.activeCalls.get(callId);
            // Use fallback for simulated calls
            if (callData.isFallback) {
                this.handleCallStatusChange(callId, 'completed');
                return true;
            }
            if (this.fallbackMode) {
                throw new Error('Telephony service is in fallback mode');
            }
            // End the call via Twilio
            await this.client.calls(callId).update({ status: 'completed' });
            logger_1.default.info(`Call ended: ${callId}`);
            return true;
        }
        catch (error) {
            logger_1.default.error(`Error ending call ${callId}: ${(0, logger_1.getErrorMessage)(error)}`, { error });
            // If in fallback mode or error occurs, simulate call end
            if (this.activeCalls.has(callId)) {
                this.handleCallStatusChange(callId, 'completed');
                return true;
            }
            return false;
        }
    }
    /**
     * Handles incoming webhook for call status changes
     */
    handleWebhook(eventType, data) {
        const callId = data.CallSid;
        if (!callId) {
            logger_1.default.error('Received webhook without CallSid', { data });
            return;
        }
        switch (eventType) {
            case 'call-status':
                this.handleCallStatusChange(callId, data.CallStatus);
                break;
            case 'recording-status':
                this.handleRecordingUpdate(callId, data);
                break;
            default:
                logger_1.default.warn(`Unknown webhook event type: ${eventType}`, { data });
        }
    }
    /**
     * Updates call status based on webhook data
     */
    handleCallStatusChange(callId, status) {
        if (!this.activeCalls.has(callId)) {
            // This might be a new incoming call we're not tracking yet
            if (status === 'ringing' || status === 'initiated') {
                this.activeCalls.set(callId, {
                    id: callId,
                    status,
                    startTime: new Date().toISOString(),
                    recordings: []
                });
            }
            else {
                logger_1.default.warn(`Received status update for unknown call: ${callId}`);
                return;
            }
        }
        // Update call status
        const callData = this.activeCalls.get(callId);
        const updatedCallData = { ...callData, status };
        // Add end time if call is completed or failed
        if (status === 'completed' || status === 'failed' || status === 'busy' || status === 'no-answer') {
            updatedCallData.endTime = new Date().toISOString();
        }
        this.activeCalls.set(callId, updatedCallData);
        // Emit event for status change
        this.events.emit('call-status-change', {
            callId,
            status,
            callData: updatedCallData
        });
        logger_1.default.info(`Call ${callId} status changed to ${status}`);
        // Clean up completed calls after a delay
        if (status === 'completed' || status === 'failed') {
            setTimeout(() => {
                this.activeCalls.delete(callId);
                logger_1.default.info(`Call ${callId} removed from active calls`);
            }, 300000); // 5 minutes
        }
    }
    /**
     * Updates recording information for a call
     */
    handleRecordingUpdate(callId, data) {
        if (!this.activeCalls.has(callId)) {
            logger_1.default.warn(`Received recording update for unknown call: ${callId}`);
            return;
        }
        const callData = this.activeCalls.get(callId);
        const recordings = [...(callData.recordings || [])];
        recordings.push({
            id: data.RecordingSid,
            duration: parseInt(data.RecordingDuration || '0', 10),
            url: data.RecordingUrl,
            status: data.RecordingStatus === 'completed' ? 'completed' :
                data.RecordingStatus === 'failed' ? 'failed' : 'processing'
        });
        this.activeCalls.set(callId, { ...callData, recordings });
        logger_1.default.info(`Call ${callId} recording updated: ${data.RecordingSid}`);
    }
    /**
     * Gets current status of a call
     */
    getCallStatus(callId) {
        const call = this.activeCalls.get(callId);
        return call ? call.status : null;
    }
    /**
     * Gets data for a specific call
     */
    getCallData(callId) {
        return this.activeCalls.get(callId) || null;
    }
    /**
     * Retrieves all active calls
     */
    getActiveCalls() {
        return Array.from(this.activeCalls.values());
    }
    /**
     * Subscribes to telephony events
     */
    on(event, listener) {
        this.events.on(event, listener);
    }
    /**
     * Unsubscribes from telephony events
     */
    off(event, listener) {
        this.events.off(event, listener);
    }
    /**
     * Monitors Twilio API health and toggles fallback mode
     */
    monitorApiHealth() {
        const checkApiHealth = async () => {
            try {
                if (this.fallbackMode) {
                    // Try to recover from fallback mode
                    await this.client.api.v2010.account.fetch();
                    // If no error, exit fallback mode
                    this.fallbackMode = false;
                    logger_1.default.info('Telephony service recovered from fallback mode');
                }
            }
            catch (error) {
                if (!this.fallbackMode) {
                    logger_1.default.error('Twilio API health check failed, entering fallback mode', { error });
                    this.fallbackMode = true;
                }
            }
        };
        // Check health every 5 minutes
        setInterval(checkApiHealth, 300000);
    }
    /**
     * Check service health
     */
    async checkHealth() {
        try {
            if (this.fallbackMode) {
                return {
                    status: 'degraded',
                    message: 'Telephony service is in fallback mode'
                };
            }
            // Try to fetch account info to verify API connectivity
            try {
                // Ping the Twilio API by listing a resource
                await this.client.calls.list({ limit: 1 });
                return { status: 'healthy' };
            }
            catch (error) {
                logger_1.default.error(`Twilio API check failed: ${(0, logger_1.getErrorMessage)(error)}`);
                this.fallbackMode = true;
                return {
                    status: 'unhealthy',
                    message: `Twilio API check failed: ${(0, logger_1.getErrorMessage)(error)}`
                };
            }
        }
        catch (error) {
            logger_1.default.error(`Error checking telephony service health: ${(0, logger_1.getErrorMessage)(error)}`);
            return {
                status: 'unhealthy',
                message: `Internal error: ${(0, logger_1.getErrorMessage)(error)}`
            };
        }
    }
}
exports.RealTelephonyService = RealTelephonyService;
// Create singleton instance
let telephonyService = null;
function initializeTelephonyService(config) {
    if (!telephonyService) {
        telephonyService = new RealTelephonyService(config.accountSid, config.authToken, config.webhookBaseUrl);
    }
    return telephonyService;
}
function getTelephonyService() {
    if (!telephonyService) {
        throw new Error('Telephony service not initialized');
    }
    return telephonyService;
}
exports.default = {
    initialize: initializeTelephonyService,
    getService: getTelephonyService
};
//# sourceMappingURL=realTelephonyService.js.map