import mongoose from 'mongoose';

export interface ILead extends mongoose.Document {
  name: string;
  phoneNumber: string;
  email?: string;
  company?: string;
  title?: string;
  source: string;
  languagePreference: string;
  status: string;
  notes?: string;
  tags?: string[];
  lastContacted?: Date;
  callCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Please provide a phone number'],
      trim: true,
      validate: {
        validator: function(v: string) {
          // Validate phone number format (Indian mobile numbers)
          return /^(\+91[\-\s]?)?[0]?(91)?[6789]\d{9}$/.test(v);
        },
        message: props => `${props.value} is not a valid Indian phone number!`
      }
    },
    email: {
      type: String,
      trim: true,
      match: [
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
        'Please provide a valid email',
      ],
    },
    company: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      required: [true, 'Please specify the lead source'],
      trim: true,
    },
    languagePreference: {
      type: String,
      required: [true, 'Please specify the language preference'],
      default: 'English',
      enum: ['English', 'Hindi', 'Tamil', 'Telugu', 'Marathi', 'Bengali', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi'],
    },
    status: {
      type: String,
      enum: ['New', 'Contacted', 'Qualified', 'Not Interested', 'Converted', 'Scheduled Callback'],
      default: 'New',
    },
    notes: {
      type: String,
    },
    tags: {
      type: [String],
    },
    lastContacted: {
      type: Date,
    },
    callCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Index for faster queries
LeadSchema.index({ phoneNumber: 1 });
LeadSchema.index({ status: 1 });
LeadSchema.index({ source: 1 });
LeadSchema.index({ lastContacted: 1 });

const Lead = mongoose.model<ILead>('Lead', LeadSchema);

export default Lead;
