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
exports.PriceHistory = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const priceHistorySchema = new mongoose_1.Schema({
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
}, {
    timestamps: true,
});
priceHistorySchema.index({ commodity_code: 1, 'history.date': -1 });
exports.PriceHistory = mongoose_1.default.model('CommodityPriceHistory', priceHistorySchema);
const commoditySchema = new mongoose_1.Schema({
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
}, {
    timestamps: true,
});
commoditySchema.pre('save', function () {
    this.last_updated = new Date();
});
commoditySchema.index({ category: 1 });
const Commodity = mongoose_1.default.model('Commodity', commoditySchema);
exports.default = Commodity;
//# sourceMappingURL=commodity.model.js.map