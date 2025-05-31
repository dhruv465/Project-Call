import mongoose, { Document, Schema } from 'mongoose';

export interface IABTest extends Document {
  name: string;
  description: string;
  campaignId: mongoose.Types.ObjectId;
  testType: 'script' | 'voice' | 'timing' | 'approach';
  variants: [{
    id: string;
    name: string;
    configuration: any;
    trafficAllocation: number; // percentage
    metrics: {
      calls: number;
      conversions: number;
      conversionRate: number;
      averageCallDuration: number;
      customerSatisfactionScore: number;
    };
  }];
  hypothesis: string;
  successCriteria: {
    primaryMetric: string;
    minimumImprovement: number; // percentage
    confidenceLevel: number;
    sampleSize: number;
  };
  status: 'draft' | 'running' | 'paused' | 'completed' | 'concluded';
  duration: {
    startDate: Date;
    endDate: Date;
    actualEndDate?: Date;
  };
  results: {
    winner?: string;
    confidence: number;
    statisticalSignificance: boolean;
    insights: string[];
    recommendations: string[];
  };
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const abTestSchema = new Schema<IABTest>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true
  },
  testType: {
    type: String,
    required: true,
    enum: ['script', 'voice', 'timing', 'approach']
  },
  variants: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    configuration: { type: Schema.Types.Mixed, required: true },
    trafficAllocation: { type: Number, required: true, min: 0, max: 100 },
    metrics: {
      calls: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
      conversionRate: { type: Number, default: 0 },
      averageCallDuration: { type: Number, default: 0 },
      customerSatisfactionScore: { type: Number, default: 0 }
    }
  }],
  hypothesis: {
    type: String,
    required: true
  },
  successCriteria: {
    primaryMetric: { type: String, required: true },
    minimumImprovement: { type: Number, required: true },
    confidenceLevel: { type: Number, default: 95 },
    sampleSize: { type: Number, required: true }
  },
  status: {
    type: String,
    enum: ['draft', 'running', 'paused', 'completed', 'concluded'],
    default: 'draft'
  },
  duration: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    actualEndDate: { type: Date }
  },
  results: {
    winner: { type: String },
    confidence: { type: Number, default: 0 },
    statisticalSignificance: { type: Boolean, default: false },
    insights: [{ type: String }],
    recommendations: [{ type: String }]
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
abTestSchema.index({ campaignId: 1 });
abTestSchema.index({ status: 1 });
abTestSchema.index({ 'duration.startDate': 1, 'duration.endDate': 1 });

export default mongoose.model<IABTest>('ABTest', abTestSchema);
