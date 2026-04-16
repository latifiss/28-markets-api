import mongoose, { Schema, Types, Document } from 'mongoose';

export interface IApiUsage extends Document {
  apiKeyId: Types.ObjectId;
  endpoint: string;
  method: string;
  month: number;
  year: number;
  count: number;
}

const apiUsageSchema = new Schema<IApiUsage>({
  apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true },
  endpoint: { type: String, required: true },
  method: { type: String, required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  count: { type: Number, default: 1 }
}, { timestamps: true });

apiUsageSchema.index({ apiKeyId: 1, month: 1, year: 1 });

export default mongoose.model<IApiUsage>('ApiUsage', apiUsageSchema);