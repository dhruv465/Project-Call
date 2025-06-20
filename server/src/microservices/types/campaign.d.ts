import { ObjectId } from 'mongodb';

export interface ICampaign {
  _id?: ObjectId;
  name: string;
  costPerMinute?: number;
  fixedCost?: number;
  averageLeadValue?: number;
  createdAt?: Date;
  updatedAt?: Date;
  status?: 'active' | 'paused' | 'completed';
  description?: string;
  targetAudience?: string;
  goals?: {
    totalCalls?: number;
    targetConversions?: number;
    budget?: number;
  };
  performance?: {
    totalCalls?: number;
    conversions?: number;
    totalCost?: number;
    revenue?: number;
  };
}
