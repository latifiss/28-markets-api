import mongoose, { Schema, Document } from 'mongoose';

export interface IPriceHistory extends Document {
  goldbod_id: string;
  history: Array<{
    date: Date;
    price: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const priceHistorySchema = new Schema<IPriceHistory>(
  {
    goldbod_id: { 
      type: String, 
      required: true, 
      index: true 
    },
    history: [
      {
        date: { 
          type: Date, 
          required: true,
          default: Date.now 
        },
        price: { 
          type: Number, 
          required: true 
        },
      },
    ],
  },
  { 
    timestamps: true,
  }
);

priceHistorySchema.index({ goldbod_id: 1, 'history.date': -1 });

export const PriceHistory = mongoose.model<IPriceHistory>('GoldbodPriceHistory', priceHistorySchema);

export interface IGoldbod extends Document {
  code: string;
  name: string;
  unit: string;
  currentPrice: number;
  percentage_change: number;
  last_updated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const goldbodSchema = new Schema<IGoldbod>(
  {
    code: { 
      type: String, 
      required: true, 
      unique: true, 
      default: 'goldbod' 
    },
    name: { 
      type: String, 
      required: true, 
      default: 'Goldbod' 
    },
    unit: { 
      type: String, 
      required: true, 
      default: 'pounds' 
    },
    currentPrice: { 
      type: Number, 
      required: true 
    },
    percentage_change: { 
      type: Number, 
      required: true 
    },
    last_updated: { 
      type: Date, 
      default: Date.now 
    },
  },
  { 
    timestamps: true,
  }
);

goldbodSchema.pre<IGoldbod>('save', function () {
  this.last_updated = new Date();
});

const Goldbod = mongoose.model<IGoldbod>('Goldbod', goldbodSchema);

export default Goldbod;