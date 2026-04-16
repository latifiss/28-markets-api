import mongoose, { Schema, Document } from 'mongoose';

export interface IEvent extends Document {
  code: string;
  title: string;
  type: 'economic' | 'earnings' | 'dividend' | 'ipo' | 'treasury';
  actual?: string;
  forecast?: string;
  previous?: string;
  is_new: boolean;
  is_new_set_at?: Date | null;
  date: Date;
  last_updated: Date;
  state?: 'oversubscribed' | 'undersubscribed' | 'suspended' | 'beat' | 'missed' | 'met' | 'priced' | 'withdrawn' | 'delayed' | 'completed' | 'announced' | 'increased' | 'decreased';
  stateOptions: string[];
  is_new_expires_in: string | null;
}

interface IEventModel extends mongoose.Model<IEvent> {
  updateExpiredNewFlags(): Promise<any>;
}

const eventSchema = new Schema<IEvent>({
  code: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: ['economic', 'earnings', 'dividend', 'ipo', 'treasury'],
  },
  actual: { type: String },
  forecast: { type: String },
  previous: { type: String },
  is_new: { type: Boolean, default: false },
  is_new_set_at: { type: Date },
  date: { type: Date, required: true },
  last_updated: { type: Date, default: Date.now },
  state: {
    type: String,
    enum: [
      'oversubscribed',
      'undersubscribed',
      'suspended',
      'beat',
      'missed',
      'met',
      'priced',
      'withdrawn',
      'delayed',
      'completed',
      'announced',
      'increased',
      'decreased',
    ],
  },
});

eventSchema.virtual('stateOptions').get(function(this: IEvent) {
  const options = {
    treasury: ['oversubscribed', 'undersubscribed', 'suspended'],
    economic: ['beat', 'missed', 'met'],
    earnings: ['beat', 'missed', 'met'],
    ipo: ['priced', 'withdrawn', 'delayed', 'completed'],
    dividend: ['announced', 'increased', 'decreased', 'suspended'],
  };
  return options[this.type] || [];
});

eventSchema.pre<IEvent>('save', function(this: IEvent, next) {
  if (this.isModified('is_new') && this.is_new === true) {
    this.is_new_set_at = new Date();
  } else if (this.isModified('is_new') && this.is_new === false) {
    this.is_new_set_at = null;
  }
});

eventSchema.statics.updateExpiredNewFlags = async function() {
  const now = new Date();
  const fourDaysAgo = new Date(now);
  fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

  const fourDaysAgoUTC = new Date(
    Date.UTC(
      fourDaysAgo.getUTCFullYear(),
      fourDaysAgo.getUTCMonth(),
      fourDaysAgo.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );

  const result = await this.updateMany(
    {
      is_new: true,
      is_new_set_at: { $lte: fourDaysAgoUTC },
    },
    {
      $set: { is_new: false },
      $unset: { is_new_set_at: 1 },
    }
  );

  return result;
};

eventSchema.virtual('is_new_expires_in').get(function(this: IEvent) {
  if (!this.is_new || !this.is_new_set_at) return null;

  const expiryDate = new Date(this.is_new_set_at);
  expiryDate.setDate(expiryDate.getDate() + 4);

  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();

  if (diffMs <= 0) return 'expired';

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(
    (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );

  return `${diffDays}d ${diffHours}h`;
});

const Event = mongoose.model<IEvent, IEventModel>('Event', eventSchema);

export default Event;