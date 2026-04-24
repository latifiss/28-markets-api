"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoinHistory = exports.getTopLosers = exports.getTopGainers = exports.getComprehensiveCoinData = exports.syncWithCrypto = exports.CoinLosers = exports.CoinGainers = exports.Crypto = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const priceHistorySchema = new mongoose_1.Schema({
    date: {
        type: Date,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
}, { _id: false });
const cryptoSchema = new mongoose_1.Schema({
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
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
cryptoSchema.index({ symbol: 1 });
cryptoSchema.index({ market_cap_rank: 1 });
cryptoSchema.index({ price_change_percentage_24h: -1 });
cryptoSchema.index({ 'price_history.date': -1 });
cryptoSchema.virtual('current_price_formatted').get(function () {
    const price = this.current_price;
    return `$${(price === null || price === void 0 ? void 0 : price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })) || '0.00'}`;
});
const Crypto = mongoose_1.default.model('Crypto', cryptoSchema);
exports.Crypto = Crypto;
const coinGainerSchema = new mongoose_1.Schema({
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
}, { timestamps: true });
const coinLoserSchema = new mongoose_1.Schema({
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
}, { timestamps: true });
const CoinGainers = mongoose_1.default.model('CoinGainers', coinGainerSchema);
exports.CoinGainers = CoinGainers;
const CoinLosers = mongoose_1.default.model('CoinLosers', coinLoserSchema);
exports.CoinLosers = CoinLosers;
const syncWithCrypto = async () => {
    try {
        const gainers = await Crypto.find({ price_change_percentage_24h: { $gt: 0 } })
            .sort({ price_change_percentage_24h: -1 })
            .limit(100);
        for (const crypto of gainers) {
            const priceChangePercentage = crypto.price_change_percentage_24h;
            if (priceChangePercentage) {
                await CoinGainers.findOneAndUpdate({ symbol: crypto.symbol }, {
                    symbol: crypto.symbol,
                    name: crypto.name,
                    percentage_change_24h: priceChangePercentage,
                    current_price: crypto.current_price,
                    market_cap_rank: crypto.market_cap_rank,
                    last_updated: new Date(),
                }, { upsert: true, new: true });
            }
        }
        const losers = await Crypto.find({ price_change_percentage_24h: { $lt: 0 } })
            .sort({ price_change_percentage_24h: 1 })
            .limit(100);
        for (const crypto of losers) {
            const priceChangePercentage = crypto.price_change_percentage_24h;
            if (priceChangePercentage) {
                await CoinLosers.findOneAndUpdate({ symbol: crypto.symbol }, {
                    symbol: crypto.symbol,
                    name: crypto.name,
                    percentage_change_24h: priceChangePercentage,
                    current_price: crypto.current_price,
                    market_cap_rank: crypto.market_cap_rank,
                    last_updated: new Date(),
                }, { upsert: true, new: true });
            }
        }
        // Clean up old entries (optional)
        await CoinGainers.deleteMany({ last_updated: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
        await CoinLosers.deleteMany({ last_updated: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
        return { success: true, message: 'CoinGainers and CoinLosers synced' };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error syncing with crypto:', errorMessage);
        return { success: false, error: errorMessage };
    }
};
exports.syncWithCrypto = syncWithCrypto;
const getComprehensiveCoinData = async (symbol) => {
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
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error getting comprehensive crypto data:', errorMessage);
        return null;
    }
};
exports.getComprehensiveCoinData = getComprehensiveCoinData;
const getTopGainers = async (limit = 10) => {
    try {
        return await CoinGainers.find()
            .sort({ percentage_change_24h: -1 })
            .limit(limit);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error getting top gainers:', errorMessage);
        return [];
    }
};
exports.getTopGainers = getTopGainers;
const getTopLosers = async (limit = 10) => {
    try {
        return await CoinLosers.find()
            .sort({ percentage_change_24h: 1 })
            .limit(limit);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error getting top losers:', errorMessage);
        return [];
    }
};
exports.getTopLosers = getTopLosers;
const pricePointSchema = new mongoose_1.Schema({
    timestamp: {
        type: Number,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
}, { _id: false });
const marketDataSchema = new mongoose_1.Schema({
    prices: [pricePointSchema],
}, { _id: false });
const coinHistorySchema = new mongoose_1.Schema({
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
}, {
    timestamps: true,
});
coinHistorySchema.index({ symbol: 1, timeframe: 1, vs_currency: 1 }, { unique: true });
coinHistorySchema.index({ 'market_data.prices.timestamp': -1 });
const CoinHistory = mongoose_1.default.model('CoinHistory', coinHistorySchema);
exports.CoinHistory = CoinHistory;
//# sourceMappingURL=crypto.model.js.map