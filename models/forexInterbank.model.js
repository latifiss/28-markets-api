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
}, {
    timestamps: true,
});
priceHistorySchema.index({ bank_code: 1, 'history.date': -1 });
exports.PriceHistory = mongoose_1.default.model('ForexInterbankPriceHistory', priceHistorySchema);
const forexInterbankSchema = new mongoose_1.Schema({
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
}, {
    timestamps: true,
});
forexInterbankSchema.pre('save', function () {
    this.last_updated = new Date();
});
forexInterbankSchema.index({ code: 1 });
const ForexInterbank = mongoose_1.default.model('ForexInterbank', forexInterbankSchema);
exports.default = ForexInterbank;
//# sourceMappingURL=forexInterbank.model.js.map