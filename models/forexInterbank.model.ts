import mongoose, { Schema, Document } from 'mongoose';

export interface IPriceHistory extends Document {
  bank_code: string;
  history: Array<{
    date: Date;
    buying_price: number;
    selling_price: number;
    midrate_price: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const priceHistorySchema = new Schema<IPriceHistory>(
  {
    bank_code: { 
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
        buying_price: { 
          type: Number, 
          required: true 
        },
        selling_price: { 
          type: Number, 
          required: true 
        },
        midrate_price: { 
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

priceHistorySchema.index({ bank_code: 1, 'history.date': -1 });

export const PriceHistory = mongoose.model<IPriceHistory>('ForexInterbankPriceHistory', priceHistorySchema);

export interface IForexInterbank extends Document {
  bankName: string;
  bankCode: string;
  code: string;
  name: string;
  from_currency: string;
  from_code: string;
  to_currency: string;
  to_code: string;
  current_buying_price: number;
  buying_percentage_change?: number;
  current_selling_price: number;
  selling_percentage_change?: number;
  current_midrate_price: number;
  midrate_percentage_change?: number;
  last_updated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const forexInterbankSchema = new Schema<IForexInterbank>(
  {
    bankName: { type: String, required: true },
    bankCode: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    from_currency: { type: String, required: true },
    from_code: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
    to_currency: { type: String, required: true },
    to_code: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
    current_buying_price: { type: Number, required: true },
    buying_percentage_change: { type: Number },
    current_selling_price: { type: Number, required: true },
    selling_percentage_change: { type: Number },
    current_midrate_price: { type: Number, required: true },
    midrate_percentage_change: { type: Number },
    last_updated: { type: Date, default: Date.now },
  },
  { 
    timestamps: true,
  }
);

forexInterbankSchema.pre<IForexInterbank>('save', function () {
  this.last_updated = new Date();
});

forexInterbankSchema.index({ code: 1 });

const ForexInterbank = mongoose.model<IForexInterbank>('ForexInterbank', forexInterbankSchema);

export default ForexInterbank;