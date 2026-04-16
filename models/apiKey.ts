import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IApiKey extends Document {
  userId: Types.ObjectId;
  key: string;
  description?: string;
  revoked: boolean;
  createdAt: Date;
}

const apiKeySchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  key: { type: String, required: true, unique: true },
  description: { type: String },
  revoked: { type: Boolean, default: false },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

export default mongoose.model<IApiKey>('ApiKey', apiKeySchema);