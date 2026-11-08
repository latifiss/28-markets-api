import './strictUpdateValidation';
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IApiKey extends Document {
  userId: Types.ObjectId;
  key?: string;
  keyHash?: string;
  description?: string;
  revoked: boolean;
  createdAt: Date;
}

const apiKeySchema = new Schema<IApiKey>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Legacy plaintext keys remain optional for lazy migration.
    key: {
      type: String,
      required: false,
      select: false,
    },
    keyHash: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      select: false,
    },
    description: String,
    revoked: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

apiKeySchema.index({ userId: 1, revoked: 1, createdAt: -1 });

export default mongoose.model<IApiKey>('ApiKey', apiKeySchema);
