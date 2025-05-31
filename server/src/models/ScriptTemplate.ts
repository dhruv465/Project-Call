import mongoose, { Document, Schema } from 'mongoose';

export interface IScriptTemplate extends Document {
  name: string;
  description: string;
  category: string;
  industry: string;
  template: {
    opening: string;
    presentation: string;
    objectionHandling: string[];
    closing: string;
    variables: { [key: string]: string };
  };
  performance: {
    conversionRate: number;
    averageCallDuration: number;
    customerSatisfactionScore: number;
    usageCount: number;
  };
  compliance: {
    regulatoryChecks: string[];
    region: string[];
    lastVerified: Date;
    approved: boolean;
  };
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const scriptTemplateSchema = new Schema<IScriptTemplate>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['sales', 'survey', 'follow-up', 'appointment', 'feedback', 'lead-qualification']
  },
  industry: {
    type: String,
    required: true
  },
  template: {
    opening: { type: String, required: true },
    presentation: { type: String, required: true },
    objectionHandling: [{ type: String }],
    closing: { type: String, required: true },
    variables: {
      type: Map,
      of: String
    }
  },
  performance: {
    conversionRate: { type: Number, default: 0 },
    averageCallDuration: { type: Number, default: 0 },
    customerSatisfactionScore: { type: Number, default: 0 },
    usageCount: { type: Number, default: 0 }
  },
  compliance: {
    regulatoryChecks: [{ type: String }],
    region: [{ type: String }],
    lastVerified: { type: Date, default: Date.now },
    approved: { type: Boolean, default: false }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for performance
scriptTemplateSchema.index({ category: 1, industry: 1 });
scriptTemplateSchema.index({ 'performance.conversionRate': -1 });
scriptTemplateSchema.index({ createdBy: 1 });

export default mongoose.model<IScriptTemplate>('ScriptTemplate', scriptTemplateSchema);
