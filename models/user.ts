import mongoose, { Schema, Document } from 'mongoose';

export type PlanTier = 'free' | 'pro' | 'business';

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  isActive: boolean;
  tier: PlanTier;
  role: 'user' | 'admin';
  stripeCustomerId?: string;
  subscriptionStatus?: 'active' | 'past_due' | 'canceled' | 'incomplete';
  currentPeriodEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
    tier: {
      type: String,
      enum: ['free', 'pro', 'business'],
      default: 'free',
    },
    stripeCustomerId: {
      type: String,
      required: false,
      unique: false,
      sparse: true,
    },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'past_due', 'canceled', 'incomplete'],
      default: 'active',
    },
    currentPeriodEnd: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IUser>('User', userSchema);