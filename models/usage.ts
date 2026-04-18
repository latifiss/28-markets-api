import mongoose, { Schema, Document } from 'mongoose';

export interface IUsage extends Document {
  userId: mongoose.Types.ObjectId;
  endpoint: string;
  method: string;
  yearMonth: string;
  count: number;
  lastRequestAt: Date;
}

const usageSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    endpoint: {
      type: String,
      required: true,
    },
    method: {
      type: String,
      required: true,
      uppercase: true,
    },
    yearMonth: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}$/,
    },
    count: {
      type: Number,
      default: 1,
      min: 0,
    },
    lastRequestAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

usageSchema.index({ userId: 1, yearMonth: 1 });
usageSchema.index({ userId: 1, yearMonth: 1, endpoint: 1 });
usageSchema.index({ userId: 1, lastRequestAt: -1 });

export default mongoose.model<IUsage>('Usage', usageSchema);