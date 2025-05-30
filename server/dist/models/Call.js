"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const CallSchema = new mongoose_1.default.Schema({
    campaign: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Campaign',
        required: true,
    },
    lead: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Lead',
        required: true,
    },
    twilioCallSid: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['Initiated', 'Ringing', 'In-Progress', 'Completed', 'Failed', 'No-Answer', 'Busy'],
        default: 'Initiated',
    },
    outcome: {
        type: String,
        enum: ['Interested', 'Not Interested', 'Call Back', 'Wrong Number', 'Disconnected', 'No Outcome'],
        default: 'No Outcome',
    },
    startTime: {
        type: Date,
        required: true,
    },
    endTime: {
        type: Date,
    },
    duration: {
        type: Number,
        default: 0, // in seconds
    },
    recordingUrl: {
        type: String,
    },
    transcript: {
        type: String,
    },
    conversationLog: [
        {
            role: {
                type: String,
                enum: ['system', 'assistant', 'customer'],
                required: true,
            },
            content: {
                type: String,
                required: true,
            },
            timestamp: {
                type: Date,
                default: Date.now,
            },
        },
    ],
    customerIntents: {
        type: [String],
    },
    sentiment: {
        type: String,
        enum: ['Positive', 'Neutral', 'Negative', 'Unknown'],
        default: 'Unknown',
    },
    callback: {
        scheduled: {
            type: Boolean,
            default: false,
        },
        dateTime: {
            type: Date,
        },
        notes: {
            type: String,
        },
    },
    notes: {
        type: String,
    },
    createdBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, { timestamps: true });
// Index for faster queries
CallSchema.index({ campaign: 1 });
CallSchema.index({ lead: 1 });
CallSchema.index({ outcome: 1 });
CallSchema.index({ startTime: 1 });
CallSchema.index({ twilioCallSid: 1 }, { unique: true });
CallSchema.index({ 'callback.scheduled': 1, 'callback.dateTime': 1 });
// Middleware for sending notifications when call status changes
CallSchema.post('save', async function (doc) {
    try {
        // Only send notification if the document has been populated with campaign and lead
        if (doc.populated('campaign') && doc.populated('lead')) {
            // Import here to avoid circular dependency
            const { sendCallNotification } = require('../controllers/notificationController');
            // Send notification
            await sendCallNotification(doc);
        }
    }
    catch (error) {
        console.error('Error sending call notification:', error);
    }
});
const Call = mongoose_1.default.model('Call', CallSchema);
exports.default = Call;
//# sourceMappingURL=Call.js.map