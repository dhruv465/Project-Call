import mongoose from 'mongoose';

export interface ICall extends mongoose.Document {
  campaign: mongoose.Schema.Types.ObjectId;
  lead: mongoose.Schema.Types.ObjectId;
  twilioCallSid: string;
  status: string;
  outcome: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  recordingUrl?: string;
  transcript?: string;
  conversationLog: {
    role: string;
    content: string;
    timestamp: Date;
  }[];
  customerIntents: string[];
  sentiment: string;
  callback?: {
    scheduled: boolean;
    dateTime: Date;
    notes: string;
  };
  notes?: string;
  createdBy: mongoose.Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CallSchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
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
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Index for faster queries
CallSchema.index({ campaign: 1 });
CallSchema.index({ lead: 1 });
CallSchema.index({ outcome: 1 });
CallSchema.index({ startTime: 1 });
CallSchema.index({ twilioCallSid: 1 }, { unique: true });
CallSchema.index({ 'callback.scheduled': 1, 'callback.dateTime': 1 });

// Middleware for sending notifications when call status changes
CallSchema.post('save', async function(doc) {
  try {
    // Only send notification if the document has been populated with campaign and lead
    if (doc.populated('campaign') && doc.populated('lead')) {
      // Import here to avoid circular dependency
      const { sendCallNotification } = require('../controllers/notificationController');
      
      // Send notification
      await sendCallNotification(doc);
    }
  } catch (error) {
    console.error('Error sending call notification:', error);
  }
});

const Call = mongoose.model<ICall>('Call', CallSchema);

export default Call;
