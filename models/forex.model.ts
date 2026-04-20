import mongoose, { Schema, Document } from 'mongoose';

export interface IPriceHistory extends Document {
  forex_code: string;
  history: Array<{
    date: Date;
    price: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const priceHistorySchema = new Schema<IPriceHistory>(
  {
    forex_code: { 
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

priceHistorySchema.index({ forex_code: 1, 'history.date': -1 });

export const PriceHistory = mongoose.model<IPriceHistory>('ForexPriceHistory', priceHistorySchema);

export interface IForex extends Document {
  code: string;
  name: string;
  from_currency: string;
  from_code: string;
  to_currency: string;
  to_code: string;
  currentPrice: number;
  percentage_change: number;
  monthly_change?: number;
  yearly_change?: number;
  last_updated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const forexSchema = new Schema<IForex>(
  {
    code: { 
      type: String, 
      required: true, 
      unique: true
    },
    name: { 
      type: String, 
      required: true 
    },
    from_currency: { 
      type: String, 
      required: true 
    },
    from_code: { 
      type: String, 
      required: true, 
      uppercase: true, 
      minlength: 3, 
      maxlength: 3 
    },
    to_currency: { 
      type: String, 
      required: true 
    },
    to_code: { 
      type: String, 
      required: true, 
      uppercase: true, 
      minlength: 3, 
      maxlength: 3 
    },
    currentPrice: { 
      type: Number, 
      required: true 
    },
    percentage_change: { 
      type: Number, 
      required: true 
    },
    monthly_change: { 
      type: Number 
    },
    yearly_change: { 
      type: Number 
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

forexSchema.pre<IForex>('save', function () {
  this.last_updated = new Date();
});

const Forex = mongoose.model<IForex>('Forex', forexSchema);

export default Forex;