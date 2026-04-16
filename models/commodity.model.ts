import mongoose, { Schema, Document } from 'mongoose';

export interface IPriceHistory extends Document {
  commodity_code: string;
  history: Array<{
    date: Date;
    price: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const priceHistorySchema = new Schema<IPriceHistory>(
  {
    commodity_code: { 
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

priceHistorySchema.index({ commodity_code: 1, 'history.date': -1 });

export const PriceHistory = mongoose.model<IPriceHistory>('CommodityPriceHistory', priceHistorySchema);

export interface ICommodity extends Document {
  code: string;
  name: string;
  unit: string;
  category: string;
  currentPrice: number;
  percentage_change: number;
  last_updated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const commoditySchema = new Schema<ICommodity>(
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
    unit: { 
      type: String, 
      required: true 
    },
    category: {
      type: String,
      required: true,
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

commoditySchema.pre<ICommodity>('save', function () {
  this.last_updated = new Date();
});

commoditySchema.index({ code: 1 });
commoditySchema.index({ category: 1 });

const Commodity = mongoose.model<ICommodity>('Commodity', commoditySchema);

export default Commodity;