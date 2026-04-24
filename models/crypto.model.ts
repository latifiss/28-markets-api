import mongoose, { Schema } from 'mongoose';

interface IPriceHistory {
  date: Date;
  price: number;
}

interface ICrypto extends Document {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price: number;
  market_cap?: number;
  market_cap_rank?: number;
  fully_diluted_valuation?: number;
  total_volume?: number;
  high_24h?: number;
  low_24h?: number;
  price_change_24h?: number;
  price_change_percentage_24h?: number;
  market_cap_change_24h?: number;
  market_cap_change_percentage_24h?: number;
  price_history: IPriceHistory[];
  last_updated: Date;
  createdAt: Date;
  updatedAt: Date;
  current_price_formatted: string;
}

interface ICoinGainer extends Document {
  symbol: string;
  name: string;
  percentage_change_24h: number;
  percentage_change_7d?: number;
  percentage_change_30d?: number;
  current_price: number;
  market_cap_rank?: number;
  last_updated: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ICoinLoser extends Document {
  symbol: string;
  name: string;
  percentage_change_24h: number;
  percentage_change_7d?: number;
  percentage_change_30d?: number;
  current_price: number;
  market_cap_rank?: number;
  last_updated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const priceHistorySchema = new Schema<IPriceHistory>(
  {
    date: {
      type: Date,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const cryptoSchema = new Schema<ICrypto>(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    symbol: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      trim: true,
    },
    current_price: {
      type: Number,
      required: true,
    },
    market_cap: {
      type: Number,
    },
    market_cap_rank: {
      type: Number,
    },
    fully_diluted_valuation: {
      type: Number,
    },
    total_volume: {
      type: Number,
    },
    high_24h: {
      type: Number,
    },
    low_24h: {
      type: Number,
    },
    price_change_24h: {
      type: Number,
    },
    price_change_percentage_24h: {
      type: Number,
    },
    market_cap_change_24h: {
      type: Number,
    },
    market_cap_change_percentage_24h: {
      type: Number,
    },
    price_history: [priceHistorySchema],
    last_updated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

cryptoSchema.index({ symbol: 1 });
cryptoSchema.index({ market_cap_rank: 1 });
cryptoSchema.index({ price_change_percentage_24h: -1 });
cryptoSchema.index({ 'price_history.date': -1 });

cryptoSchema.virtual('current_price_formatted').get(function(this: ICrypto) {
  const price = this.current_price;
  return `$${
    price?.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) || '0.00'
  }`;
});

const Crypto = mongoose.model<ICrypto>('Crypto', cryptoSchema);

const coinGainerSchema = new Schema<ICoinGainer>(
  {
    symbol: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
    },
    percentage_change_24h: {
      type: Number,
      required: true,
    },
    percentage_change_7d: {
      type: Number,
    },
    percentage_change_30d: {
      type: Number,
    },
    current_price: {
      type: Number,
      required: true,
    },
    market_cap_rank: {
      type: Number,
    },
    last_updated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const coinLoserSchema = new Schema<ICoinLoser>(
  {
    symbol: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
    },
    percentage_change_24h: {
      type: Number,
      required: true,
    },
    percentage_change_7d: {
      type: Number,
    },
    percentage_change_30d: {
      type: Number,
    },
    current_price: {
      type: Number,
      required: true,
    },
    market_cap_rank: {
      type: Number,
    },
    last_updated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const CoinGainers = mongoose.model<ICoinGainer>('CoinGainers', coinGainerSchema);
const CoinLosers = mongoose.model<ICoinLoser>('CoinLosers', coinLoserSchema);

const syncWithCrypto = async () => {
  try {
    const gainers = await Crypto.find({ price_change_percentage_24h: { $gt: 0 } })
      .sort({ price_change_percentage_24h: -1 })
      .limit(100);

    for (const crypto of gainers) {
      const priceChangePercentage = crypto.price_change_percentage_24h;
      if (priceChangePercentage) {
        await CoinGainers.findOneAndUpdate(
          { symbol: crypto.symbol },
          {
            symbol: crypto.symbol,
            name: crypto.name,
            percentage_change_24h: priceChangePercentage,
            current_price: crypto.current_price,
            market_cap_rank: crypto.market_cap_rank,
            last_updated: new Date(),
          },
          { upsert: true, new: true }
        );
      }
    }

    const losers = await Crypto.find({ price_change_percentage_24h: { $lt: 0 } })
      .sort({ price_change_percentage_24h: 1 }) 
      .limit(100);

    for (const crypto of losers) {
      const priceChangePercentage = crypto.price_change_percentage_24h;
      if (priceChangePercentage) {
        await CoinLosers.findOneAndUpdate(
          { symbol: crypto.symbol },
          {
            symbol: crypto.symbol,
            name: crypto.name,
            percentage_change_24h: priceChangePercentage,
            current_price: crypto.current_price,
            market_cap_rank: crypto.market_cap_rank,
            last_updated: new Date(),
          },
          { upsert: true, new: true }
        );
      }
    }

    await CoinGainers.deleteMany({ last_updated: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    await CoinLosers.deleteMany({ last_updated: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } });

    return { success: true, message: 'CoinGainers and CoinLosers synced' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error syncing with crypto:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

const getComprehensiveCoinData = async (symbol: string) => {
  try {
    const crypto = await Crypto.findOne({
      symbol: symbol.toUpperCase(),
    });

    if (!crypto) {
      return null;
    }

    const gainer = await CoinGainers.findOne({
      symbol: symbol.toUpperCase(),
    });

    const loser = await CoinLosers.findOne({
      symbol: symbol.toUpperCase(),
    });

    return {
      ...crypto.toObject(),
      isGainer: !!gainer,
      gainerData: gainer || null,
      isLoser: !!loser,
      loserData: loser || null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error getting comprehensive crypto data:', errorMessage);
    return null;
  }
};

const getTopGainers = async (limit: number = 10) => {
  try {
    return await CoinGainers.find()
      .sort({ percentage_change_24h: -1 })
      .limit(limit);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error getting top gainers:', errorMessage);
    return [];
  }
};

const getTopLosers = async (limit: number = 10) => {
  try {
    return await CoinLosers.find()
      .sort({ percentage_change_24h: 1 }) 
      .limit(limit);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error getting top losers:', errorMessage);
    return [];
  }
};

interface IPricePoint {
  timestamp: number;
  price: number;
}

interface IMarketData {
  prices: IPricePoint[];
}

interface ICoinHistory extends Document {
  symbol: string;
  name: string;
  market_data: IMarketData;
  timeframe: string;
  vs_currency: string;
  last_updated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const pricePointSchema = new Schema<IPricePoint>(
  {
    timestamp: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const marketDataSchema = new Schema<IMarketData>(
  {
    prices: [pricePointSchema],
  },
  { _id: false }
);

const coinHistorySchema = new Schema<ICoinHistory>(
  {
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    market_data: {
      type: marketDataSchema,
      required: true,
    },
    timeframe: {
      type: String,
      required: true,
      enum: ['1', '7', '14', '30', '90', '180', '365', 'max'],
    },
    vs_currency: {
      type: String,
      required: true,
      default: 'usd',
      lowercase: true,
    },
    last_updated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

coinHistorySchema.index({ symbol: 1, timeframe: 1, vs_currency: 1 }, { unique: true });
coinHistorySchema.index({ 'market_data.prices.timestamp': -1 });

const CoinHistory = mongoose.model<ICoinHistory>('CoinHistory', coinHistorySchema);

export {
  Crypto,
  CoinGainers,
  CoinLosers,
  syncWithCrypto,
  getComprehensiveCoinData,
  getTopGainers,
  getTopLosers,
  CoinHistory
};