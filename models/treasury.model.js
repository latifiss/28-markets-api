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
const mongoose_1 = __importStar(require("mongoose"));
const treasuryBondSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
    },
    tender: {
        type: String,
        required: true,
        trim: true,
    },
    discount_rate: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
    },
    interest_rate: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
    },
    maturity: {
        type: String,
        required: true,
        enum: [
            '91-Day',
            '182-Day',
            '364-Day',
            '2-Year',
            '3-Year',
            '5-Year',
            'Other',
        ],
    },
    maturity_days: {
        type: Number,
        required: true,
        min: 1,
    },
    type: {
        type: String,
        required: true,
        enum: ['T-Bill', 'Fixed Rate Note', 'Fixed Rate Bond', 'GOG Bond'],
        default: 'T-Bill',
    },
    issue_date: {
        type: Date,
        default: Date.now,
    },
    maturity_date: {
        type: Date,
    },
    face_value: {
        type: Number,
        default: 1000,
    },
    minimum_investment: {
        type: Number,
        default: 100,
    },
    yield: {
        type: Number,
        min: 0,
        max: 100,
    },
    is_active: {
        type: Boolean,
        default: true,
    },
    risk_level: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        default: 'Low',
    },
    description: {
        type: String,
        trim: true,
    },
    last_updated: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
treasuryBondSchema.index({ name: 1 });
treasuryBondSchema.index({ maturity: 1 });
treasuryBondSchema.index({ type: 1 });
treasuryBondSchema.index({ discount_rate: -1 });
treasuryBondSchema.index({ interest_rate: -1 });
treasuryBondSchema.index({ is_active: 1 });
treasuryBondSchema.virtual('discount_rate_formatted').get(function () {
    return `${this.discount_rate.toFixed(2)}%`;
});
treasuryBondSchema.virtual('interest_rate_formatted').get(function () {
    return `${this.interest_rate.toFixed(2)}%`;
});
treasuryBondSchema.virtual('days_to_maturity').get(function () {
    if (!this.maturity_date)
        return this.maturity_days;
    const today = new Date();
    const maturity = new Date(this.maturity_date);
    const diffTime = Math.abs(maturity.getTime() - today.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
});
treasuryBondSchema.methods.calculatePrice = function (investmentAmount = this.face_value) {
    const discountAmount = investmentAmount * (this.discount_rate / 100);
    const price = investmentAmount - discountAmount;
    return parseFloat(price.toFixed(2));
};
treasuryBondSchema.methods.calculateInterest = function (investmentAmount = this.face_value) {
    const interest = investmentAmount * (this.interest_rate / 100);
    return parseFloat(interest.toFixed(2));
};
treasuryBondSchema.methods.calculateTotalReturn = function (investmentAmount = this.face_value) {
    const price = this.calculatePrice(investmentAmount);
    const interest = this.calculateInterest(investmentAmount);
    const total = price + interest;
    return parseFloat(total.toFixed(2));
};
treasuryBondSchema.statics.findByMaturity = function (maturity) {
    return this.find({ maturity: new RegExp(maturity, 'i') });
};
treasuryBondSchema.statics.findActiveBonds = function () {
    return this.find({ is_active: true }).sort({ maturity_days: 1 });
};
treasuryBondSchema.statics.findHighestYielding = function (limit = 10) {
    return this.find({ is_active: true })
        .sort({ interest_rate: -1 })
        .limit(limit);
};
treasuryBondSchema.pre('save', function () {
    if (!this.maturity_days) {
        switch (this.maturity) {
            case '91-Day':
                this.maturity_days = 91;
                break;
            case '182-Day':
                this.maturity_days = 182;
                break;
            case '364-Day':
                this.maturity_days = 364;
                break;
            case '2-Year':
                this.maturity_days = 730;
                break;
            case '3-Year':
                this.maturity_days = 1095;
                break;
            case '5-Year':
                this.maturity_days = 1825;
                break;
            default:
                this.maturity_days = 91;
        }
    }
    if (!this.maturity_date && this.issue_date) {
        const maturityDate = new Date(this.issue_date);
        maturityDate.setDate(maturityDate.getDate() + this.maturity_days);
        this.maturity_date = maturityDate;
    }
    this.last_updated = new Date();
});
const TreasuryBond = mongoose_1.default.model('TreasuryBond', treasuryBondSchema);
exports.default = TreasuryBond;
//# sourceMappingURL=treasury.model.js.map