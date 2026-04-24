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
exports.GovernmentSpending = exports.FiscalExpenditure = exports.GovernmentRevenues = exports.GovernmentBudgetValue = exports.GovernmentDebtValue = exports.GovernmentDebtToGDP = exports.BalanceOfTrade = exports.UnemploymentRate = exports.InflationRate = exports.InterestRate = exports.GovernmentGDPValue = exports.GDPGrowthAnnual = exports.GDPGrowthQuarterly = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const monthlyHistorySchema = new mongoose_1.Schema({
    month: {
        type: String,
        required: true,
        enum: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    },
    year: {
        type: Number,
        required: true,
    },
    value: {
        type: Number,
        required: true,
    },
}, { _id: false });
const quarterlyHistorySchema = new mongoose_1.Schema({
    quarter: {
        type: String,
        required: true,
        enum: ['Q1', 'Q2', 'Q3', 'Q4'],
    },
    year: {
        type: Number,
        required: true,
    },
    value: {
        type: Number,
        required: true,
    },
}, { _id: false });
const annualHistorySchema = new mongoose_1.Schema({
    year: {
        type: Number,
        required: true,
    },
    value: {
        type: Number,
        required: true,
    },
}, { _id: false });
const debtHistorySchema = new mongoose_1.Schema({
    month: {
        type: String,
        required: true,
    },
    value: {
        type: Number,
        required: true,
    },
}, { _id: false });
const gdpValueHistorySchema = new mongoose_1.Schema({
    month: {
        type: String,
        required: true,
    },
    year: {
        type: Number,
        required: true,
    },
    value: {
        type: Number,
        required: true,
    },
}, { _id: false });
const gdpGrowthQuarterlySchema = new mongoose_1.Schema({
    current_value: {
        type: Number,
        required: true,
    },
    previous_value: {
        type: Number,
    },
    quarter: {
        type: String,
        required: true,
        enum: ['Q1', 'Q2', 'Q3', 'Q4'],
    },
    year: {
        type: Number,
        required: true,
        default: () => new Date().getFullYear(),
    },
    forecast: {
        type: Number,
    },
    target_min: {
        type: Number,
        default: 0,
    },
    target_max: {
        type: Number,
        default: 10,
    },
    source: {
        type: String,
        trim: true,
    },
    historical_data: [quarterlyHistorySchema],
    last_updated: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
gdpGrowthQuarterlySchema.index({ year: 1, quarter: 1 }, { unique: true });
gdpGrowthQuarterlySchema.index({ 'historical_data.year': -1, 'historical_data.quarter': -1 });
gdpGrowthQuarterlySchema.virtual('formatted_value').get(function () {
    return `${this.current_value.toFixed(2)}%`;
});
gdpGrowthQuarterlySchema.virtual('percentage_change').get(function () {
    if (!this.previous_value || this.previous_value === 0)
        return 0;
    return ((this.current_value - this.previous_value) / Math.abs(this.previous_value)) * 100;
});
gdpGrowthQuarterlySchema.virtual('is_within_target').get(function () {
    return this.current_value >= this.target_min && this.current_value <= this.target_max;
});
gdpGrowthQuarterlySchema.methods.addToHistory = function () {
    if (this.historical_data) {
        this.historical_data.push({
            quarter: this.quarter,
            year: this.year,
            value: this.previous_value || this.current_value,
        });
        if (this.historical_data.length > 40) {
            this.historical_data = this.historical_data.slice(-40);
        }
    }
    return this;
};
gdpGrowthQuarterlySchema.statics.findLatest = function () {
    return this.findOne().sort({ year: -1, quarter: -1 });
};
gdpGrowthQuarterlySchema.statics.findByQuarterAndYear = function (quarter, year) {
    return this.findOne({ quarter, year });
};
const gdpGrowthAnnualSchema = new mongoose_1.Schema({
    current_value: {
        type: Number,
        required: true,
    },
    previous_value: {
        type: Number,
    },
    year: {
        type: Number,
        required: true,
        default: () => new Date().getFullYear(),
    },
    forecast: {
        type: Number,
    },
    target_min: {
        type: Number,
        default: 0,
    },
    target_max: {
        type: Number,
        default: 10,
    },
    source: {
        type: String,
        trim: true,
    },
    historical_data: [annualHistorySchema],
    last_updated: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
gdpGrowthAnnualSchema.index({ year: 1 }, { unique: true });
gdpGrowthAnnualSchema.index({ 'historical_data.year': -1, 'historical_data.quarter': -1 });
gdpGrowthAnnualSchema.virtual('formatted_value').get(function () {
    return `${this.current_value.toFixed(2)}%`;
});
gdpGrowthAnnualSchema.virtual('percentage_change').get(function () {
    if (!this.previous_value || this.previous_value === 0)
        return 0;
    return ((this.current_value - this.previous_value) / Math.abs(this.previous_value)) * 100;
});
gdpGrowthAnnualSchema.virtual('is_within_target').get(function () {
    return this.current_value >= this.target_min && this.current_value <= this.target_max;
});
gdpGrowthAnnualSchema.methods.addToHistory = function () {
    if (this.historical_data) {
        this.historical_data.push({
            year: this.year,
            value: this.previous_value || this.current_value,
        });
        if (this.historical_data.length > 10) {
            this.historical_data = this.historical_data.slice(-10);
        }
    }
    return this;
};
gdpGrowthAnnualSchema.statics.findLatest = function () {
    return this.findOne().sort({ year: -1 });
};
gdpGrowthAnnualSchema.statics.findByYear = function (year) {
    return this.findOne({ year });
};
const governmentGDPValueSchema = new mongoose_1.Schema({
    current_value: {
        type: Number,
        required: true,
    },
    previous_value: {
        type: Number,
    },
    current_month: {
        type: String,
        required: false,
        enum: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    },
    current_year: {
        type: Number,
        required: false,
        default: () => new Date().getFullYear(),
    },
    gdp_history: [gdpValueHistorySchema],
    last_updated: {
        type: Date,
        default: Date.now,
    },
    source: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
governmentGDPValueSchema.index({ current_year: 1, current_month: 1 }, { unique: false });
governmentGDPValueSchema.virtual('formatted_value').get(function () {
    if (this.current_value >= 1000000000) {
        return `${(this.current_value / 1000000000).toFixed(2)}B GHS`;
    }
    else if (this.current_value >= 1000000) {
        return `${(this.current_value / 1000000).toFixed(2)}M GHS`;
    }
    return `${this.current_value.toFixed(2)} GHS`;
});
governmentGDPValueSchema.virtual('percentage_change').get(function () {
    if (!this.previous_value || this.previous_value === 0)
        return 0;
    return ((this.current_value - this.previous_value) / Math.abs(this.previous_value)) * 100;
});
governmentGDPValueSchema.methods.addToHistory = function () {
    if (this.gdp_history && this.current_month && this.current_year) {
        this.gdp_history.push({
            month: this.current_month,
            year: this.current_year,
            value: this.previous_value || this.current_value,
        });
        if (this.gdp_history.length > 24) {
            this.gdp_history = this.gdp_history.slice(-24);
        }
    }
    return this;
};
governmentGDPValueSchema.statics.findLatest = function () {
    return this.findOne().sort({ last_updated: -1 });
};
governmentGDPValueSchema.pre('save', function () {
    if (this.isModified('current_value') || this.isModified('gdp_history')) {
        this.last_updated = new Date();
    }
});
const interestRateSchema = new mongoose_1.Schema({
    current_value: {
        type: Number,
        required: true,
    },
    previous_value: {
        type: Number,
    },
    effective_date: {
        type: Date,
        required: true,
        default: Date.now,
    },
    next_meeting_date: {
        type: Date,
    },
    forecast: {
        type: Number,
    },
    target_range_min: {
        type: Number,
        default: 5,
    },
    target_range_max: {
        type: Number,
        default: 20,
    },
    source: {
        type: String,
        trim: true,
    },
    historical_data: [
        {
            date: Date,
            value: Number,
            decision: String,
        },
    ],
    last_updated: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
interestRateSchema.index({ effective_date: -1 });
interestRateSchema.index({ 'historical_data.date': -1 });
interestRateSchema.virtual('formatted_value').get(function () {
    return `${this.current_value.toFixed(2)}%`;
});
interestRateSchema.virtual('percentage_change').get(function () {
    if (!this.previous_value || this.previous_value === 0)
        return 0;
    return ((this.current_value - this.previous_value) / Math.abs(this.previous_value)) * 100;
});
interestRateSchema.virtual('is_within_target').get(function () {
    return this.current_value >= this.target_range_min && this.current_value <= this.target_range_max;
});
interestRateSchema.methods.addToHistory = function () {
    if (this.historical_data) {
        this.historical_data.push({
            date: this.effective_date,
            value: this.previous_value || this.current_value,
            decision: 'rate change',
        });
        if (this.historical_data.length > 50) {
            this.historical_data = this.historical_data.slice(-50);
        }
    }
    return this;
};
interestRateSchema.statics.findLatest = function () {
    return this.findOne().sort({ effective_date: -1 });
};
const inflationRateSchema = new mongoose_1.Schema({
    current_value: {
        type: Number,
        required: true,
    },
    previous_value: {
        type: Number,
    },
    month: {
        type: String,
        required: true,
        enum: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    },
    year: {
        type: Number,
        required: true,
        default: () => new Date().getFullYear(),
    },
    forecast: {
        type: Number,
    },
    target_range_min: {
        type: Number,
        default: 6,
    },
    target_range_max: {
        type: Number,
        default: 10,
    },
    source: {
        type: String,
        trim: true,
    },
    historical_data: [monthlyHistorySchema],
    last_updated: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
inflationRateSchema.index({ year: 1, month: 1 }, { unique: true });
inflationRateSchema.index({ 'historical_data.year': -1, 'historical_data.month': -1 });
inflationRateSchema.virtual('formatted_value').get(function () {
    return `${this.current_value.toFixed(2)}%`;
});
inflationRateSchema.virtual('percentage_change').get(function () {
    if (!this.previous_value || this.previous_value === 0)
        return 0;
    return ((this.current_value - this.previous_value) / Math.abs(this.previous_value)) * 100;
});
inflationRateSchema.virtual('is_within_target').get(function () {
    return this.current_value >= this.target_range_min && this.current_value <= this.target_range_max;
});
inflationRateSchema.methods.addToHistory = function () {
    if (this.historical_data) {
        this.historical_data.push({
            month: this.month,
            year: this.year,
            value: this.previous_value || this.current_value,
        });
        if (this.historical_data.length > 24) {
            this.historical_data = this.historical_data.slice(-24);
        }
    }
    return this;
};
inflationRateSchema.statics.findLatest = function () {
    return this.findOne().sort({ year: -1, month: -1 });
};
inflationRateSchema.statics.findByMonthAndYear = function (month, year) {
    return this.findOne({ month, year });
};
const unemploymentRateSchema = new mongoose_1.Schema({
    current_value: {
        type: Number,
        required: true,
    },
    previous_value: {
        type: Number,
    },
    quarter: {
        type: String,
        required: true,
        enum: ['Q1', 'Q2', 'Q3', 'Q4'],
    },
    year: {
        type: Number,
        required: true,
        default: () => new Date().getFullYear(),
    },
    forecast: {
        type: Number,
    },
    target: {
        type: Number,
        default: 5,
    },
    source: {
        type: String,
        trim: true,
    },
    historical_data: [quarterlyHistorySchema],
    last_updated: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
unemploymentRateSchema.index({ year: 1, quarter: 1 }, { unique: true });
unemploymentRateSchema.index({ 'historical_data.year': -1, 'historical_data.quarter': -1 });
unemploymentRateSchema.virtual('formatted_value').get(function () {
    return `${this.current_value.toFixed(1)}%`;
});
unemploymentRateSchema.virtual('percentage_change').get(function () {
    if (!this.previous_value || this.previous_value === 0)
        return 0;
    return ((this.current_value - this.previous_value) / Math.abs(this.previous_value)) * 100;
});
unemploymentRateSchema.virtual('is_below_target').get(function () {
    return this.current_value <= this.target;
});
unemploymentRateSchema.methods.addToHistory = function () {
    if (this.historical_data) {
        this.historical_data.push({
            quarter: this.quarter,
            year: this.year,
            value: this.previous_value || this.current_value,
        });
        if (this.historical_data.length > 40) {
            this.historical_data = this.historical_data.slice(-40);
        }
    }
    return this;
};
unemploymentRateSchema.statics.findLatest = function () {
    return this.findOne().sort({ year: -1, quarter: -1 });
};
unemploymentRateSchema.statics.findByQuarterAndYear = function (quarter, year) {
    return this.findOne({ quarter, year });
};
const balanceOfTradeSchema = new mongoose_1.Schema({
    current_balance: {
        type: Number,
        required: true,
    },
    previous_balance: {
        type: Number,
    },
    month: {
        type: String,
        required: true,
        enum: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    },
    year: {
        type: Number,
        required: true,
        default: () => new Date().getFullYear(),
    },
    exports_value: {
        type: Number,
        required: true,
    },
    imports_value: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        default: 'USD',
    },
    source: {
        type: String,
        trim: true,
    },
    historical_data: [
        {
            month: String,
            year: Number,
            balance: Number,
            exports: Number,
            imports: Number,
        },
    ],
    last_updated: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
balanceOfTradeSchema.index({ year: 1, month: 1 }, { unique: true });
balanceOfTradeSchema.virtual('formatted_balance').get(function () {
    const absBalance = Math.abs(this.current_balance);
    if (absBalance >= 1000000000) {
        return `${(this.current_balance / 1000000000).toFixed(2)}B ${this.currency}`;
    }
    else if (absBalance >= 1000000) {
        return `${(this.current_balance / 1000000).toFixed(2)}M ${this.currency}`;
    }
    return `${this.current_balance.toFixed(2)} ${this.currency}`;
});
balanceOfTradeSchema.virtual('is_surplus').get(function () {
    return this.current_balance > 0;
});
balanceOfTradeSchema.virtual('balance_change').get(function () {
    if (!this.previous_balance)
        return 0;
    return this.current_balance - this.previous_balance;
});
balanceOfTradeSchema.methods.addToHistory = function () {
    if (this.historical_data) {
        this.historical_data.push({
            month: this.month,
            year: this.year,
            balance: this.previous_balance || this.current_balance,
            exports: this.exports_value,
            imports: this.imports_value,
        });
        if (this.historical_data.length > 24) {
            this.historical_data = this.historical_data.slice(-24);
        }
    }
    return this;
};
balanceOfTradeSchema.statics.findLatest = function () {
    return this.findOne().sort({ year: -1, month: -1 });
};
balanceOfTradeSchema.statics.findByMonthAndYear = function (month, year) {
    return this.findOne({ month, year });
};
const governmentDebtToGDPSchema = new mongoose_1.Schema({
    current_value: {
        type: Number,
        required: true,
    },
    previous_value: {
        type: Number,
    },
    year: {
        type: Number,
        required: true,
        default: () => new Date().getFullYear(),
    },
    gdp_value: {
        type: Number,
        required: true,
    },
    total_debt_value: {
        type: Number,
        required: true,
    },
    target_max: {
        type: Number,
        default: 60,
    },
    source: {
        type: String,
        trim: true,
    },
    historical_data: [annualHistorySchema],
    last_updated: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
governmentDebtToGDPSchema.index({ year: 1 }, { unique: true });
governmentDebtToGDPSchema.virtual('formatted_value').get(function () {
    return `${this.current_value.toFixed(1)}%`;
});
governmentDebtToGDPSchema.virtual('percentage_change').get(function () {
    if (!this.previous_value || this.previous_value === 0)
        return 0;
    return ((this.current_value - this.previous_value) / Math.abs(this.previous_value)) * 100;
});
governmentDebtToGDPSchema.virtual('is_below_target').get(function () {
    return this.current_value <= this.target_max;
});
governmentDebtToGDPSchema.methods.addToHistory = function () {
    if (this.historical_data) {
        this.historical_data.push({
            year: this.year,
            value: this.previous_value || this.current_value,
        });
        if (this.historical_data.length > 10) {
            this.historical_data = this.historical_data.slice(-10);
        }
    }
    return this;
};
governmentDebtToGDPSchema.statics.findLatest = function () {
    return this.findOne().sort({ year: -1 });
};
governmentDebtToGDPSchema.statics.findByYear = function (year) {
    return this.findOne({ year });
};
const governmentDebtValueSchema = new mongoose_1.Schema({
    current_value: {
        type: Number,
        required: true,
    },
    current_month: {
        type: String,
        required: false,
        enum: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    },
    current_year: {
        type: Number,
        required: false,
        default: () => new Date().getFullYear(),
    },
    debt_history: [debtHistorySchema],
    last_updated: {
        type: Date,
        default: Date.now,
    },
    source: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
governmentDebtValueSchema.index({ current_year: 1, current_month: 1 }, { unique: false });
governmentDebtValueSchema.virtual('formatted_value').get(function () {
    if (this.current_value >= 1000000000) {
        return `${(this.current_value / 1000000000).toFixed(2)}B GHS`;
    }
    else if (this.current_value >= 1000000) {
        return `${(this.current_value / 1000000).toFixed(2)}M GHS`;
    }
    return `${this.current_value.toFixed(2)} GHS`;
});
governmentDebtValueSchema.methods.addToHistory = function () {
    if (this.debt_history && this.current_month) {
        this.debt_history.push({
            month: this.current_month,
            value: this.current_value,
        });
        if (this.debt_history.length > 24) {
            this.debt_history = this.debt_history.slice(-24);
        }
    }
    return this;
};
governmentDebtValueSchema.pre('save', function () {
    if (this.isModified('current_value') || this.isModified('debt_history')) {
        this.last_updated = new Date();
    }
});
const governmentBudgetValueSchema = new mongoose_1.Schema({
    current_value: {
        type: Number,
        required: true,
    },
    previous_value: {
        type: Number,
    },
    month: {
        type: String,
        required: true,
        enum: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    },
    year: {
        type: Number,
        required: true,
        default: () => new Date().getFullYear(),
    },
    revenue_value: {
        type: Number,
        required: true,
    },
    expenditure_value: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        default: 'GHS',
    },
    source: {
        type: String,
        trim: true,
    },
    historical_data: [
        {
            month: String,
            year: Number,
            value: Number,
            revenue: Number,
            expenditure: Number,
        },
    ],
    last_updated: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
governmentBudgetValueSchema.index({ year: 1, month: 1 }, { unique: true });
governmentBudgetValueSchema.virtual('formatted_value').get(function () {
    const absValue = Math.abs(this.current_value);
    if (absValue >= 1000000000) {
        return `${(this.current_value / 1000000000).toFixed(2)}B ${this.currency}`;
    }
    else if (absValue >= 1000000) {
        return `${(this.current_value / 1000000).toFixed(2)}M ${this.currency}`;
    }
    return `${this.current_value.toFixed(2)} ${this.currency}`;
});
governmentBudgetValueSchema.virtual('is_surplus').get(function () {
    return this.current_value > 0;
});
governmentBudgetValueSchema.virtual('balance_change').get(function () {
    if (!this.previous_value)
        return 0;
    return this.current_value - this.previous_value;
});
governmentBudgetValueSchema.methods.addToHistory = function () {
    if (this.historical_data) {
        this.historical_data.push({
            month: this.month,
            year: this.year,
            value: this.previous_value || this.current_value,
            revenue: this.revenue_value,
            expenditure: this.expenditure_value,
        });
        if (this.historical_data.length > 24) {
            this.historical_data = this.historical_data.slice(-24);
        }
    }
    return this;
};
governmentBudgetValueSchema.statics.findLatest = function () {
    return this.findOne().sort({ year: -1, month: -1 });
};
const governmentRevenuesSchema = new mongoose_1.Schema({
    current_value: {
        type: Number,
        required: true,
    },
    previous_value: {
        type: Number,
    },
    month: {
        type: String,
        required: true,
        enum: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    },
    year: {
        type: Number,
        required: true,
        default: () => new Date().getFullYear(),
    },
    currency: {
        type: String,
        default: 'GHS',
    },
    source: {
        type: String,
        trim: true,
    },
    historical_data: [monthlyHistorySchema],
    last_updated: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
governmentRevenuesSchema.index({ year: 1, month: 1 }, { unique: true });
governmentRevenuesSchema.virtual('formatted_value').get(function () {
    if (this.current_value >= 1000000000) {
        return `${(this.current_value / 1000000000).toFixed(2)}B ${this.currency}`;
    }
    else if (this.current_value >= 1000000) {
        return `${(this.current_value / 1000000).toFixed(2)}M ${this.currency}`;
    }
    return `${this.current_value.toFixed(2)} ${this.currency}`;
});
governmentRevenuesSchema.virtual('percentage_change').get(function () {
    if (!this.previous_value || this.previous_value === 0)
        return 0;
    return ((this.current_value - this.previous_value) / Math.abs(this.previous_value)) * 100;
});
governmentRevenuesSchema.methods.addToHistory = function () {
    if (this.historical_data) {
        this.historical_data.push({
            month: this.month,
            year: this.year,
            value: this.previous_value || this.current_value,
        });
        if (this.historical_data.length > 24) {
            this.historical_data = this.historical_data.slice(-24);
        }
    }
    return this;
};
governmentRevenuesSchema.statics.findLatest = function () {
    return this.findOne().sort({ year: -1, month: -1 });
};
const fiscalExpenditureSchema = new mongoose_1.Schema({
    current_value: {
        type: Number,
        required: true,
    },
    previous_value: {
        type: Number,
    },
    month: {
        type: String,
        required: true,
        enum: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    },
    year: {
        type: Number,
        required: true,
        default: () => new Date().getFullYear(),
    },
    currency: {
        type: String,
        default: 'GHS',
    },
    source: {
        type: String,
        trim: true,
    },
    historical_data: [monthlyHistorySchema],
    last_updated: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
fiscalExpenditureSchema.index({ year: 1, month: 1 }, { unique: true });
fiscalExpenditureSchema.virtual('formatted_value').get(function () {
    if (this.current_value >= 1000000000) {
        return `${(this.current_value / 1000000000).toFixed(2)}B ${this.currency}`;
    }
    else if (this.current_value >= 1000000) {
        return `${(this.current_value / 1000000).toFixed(2)}M ${this.currency}`;
    }
    return `${this.current_value.toFixed(2)} ${this.currency}`;
});
fiscalExpenditureSchema.virtual('percentage_change').get(function () {
    if (!this.previous_value || this.previous_value === 0)
        return 0;
    return ((this.current_value - this.previous_value) / Math.abs(this.previous_value)) * 100;
});
fiscalExpenditureSchema.methods.addToHistory = function () {
    if (this.historical_data) {
        this.historical_data.push({
            month: this.month,
            year: this.year,
            value: this.previous_value || this.current_value,
        });
        if (this.historical_data.length > 24) {
            this.historical_data = this.historical_data.slice(-24);
        }
    }
    return this;
};
fiscalExpenditureSchema.statics.findLatest = function () {
    return this.findOne().sort({ year: -1, month: -1 });
};
const governmentSpendingSchema = new mongoose_1.Schema({
    current_value: {
        type: Number,
        required: true,
    },
    previous_value: {
        type: Number,
    },
    year: {
        type: Number,
        required: true,
        default: () => new Date().getFullYear(),
    },
    currency: {
        type: String,
        default: 'GHS',
    },
    source: {
        type: String,
        trim: true,
    },
    historical_data: [annualHistorySchema],
    last_updated: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
governmentSpendingSchema.index({ year: 1 }, { unique: true });
governmentSpendingSchema.virtual('formatted_value').get(function () {
    if (this.current_value >= 1000000000) {
        return `${(this.current_value / 1000000000).toFixed(2)}B ${this.currency}`;
    }
    else if (this.current_value >= 1000000) {
        return `${(this.current_value / 1000000).toFixed(2)}M ${this.currency}`;
    }
    return `${this.current_value.toFixed(2)} ${this.currency}`;
});
governmentSpendingSchema.virtual('percentage_change').get(function () {
    if (!this.previous_value || this.previous_value === 0)
        return 0;
    return ((this.current_value - this.previous_value) / Math.abs(this.previous_value)) * 100;
});
governmentSpendingSchema.methods.addToHistory = function () {
    if (this.historical_data) {
        this.historical_data.push({
            year: this.year,
            value: this.previous_value || this.current_value,
        });
        if (this.historical_data.length > 10) {
            this.historical_data = this.historical_data.slice(-10);
        }
    }
    return this;
};
governmentSpendingSchema.statics.findLatest = function () {
    return this.findOne().sort({ year: -1 });
};
const GDPGrowthQuarterly = mongoose_1.default.model('GDPGrowthQuarterly', gdpGrowthQuarterlySchema);
exports.GDPGrowthQuarterly = GDPGrowthQuarterly;
const GDPGrowthAnnual = mongoose_1.default.model('GDPGrowthAnnual', gdpGrowthAnnualSchema);
exports.GDPGrowthAnnual = GDPGrowthAnnual;
const GovernmentGDPValue = mongoose_1.default.model('GovernmentGDPValue', governmentGDPValueSchema);
exports.GovernmentGDPValue = GovernmentGDPValue;
const InterestRate = mongoose_1.default.model('InterestRate', interestRateSchema);
exports.InterestRate = InterestRate;
const InflationRate = mongoose_1.default.model('InflationRate', inflationRateSchema);
exports.InflationRate = InflationRate;
const UnemploymentRate = mongoose_1.default.model('UnemploymentRate', unemploymentRateSchema);
exports.UnemploymentRate = UnemploymentRate;
const BalanceOfTrade = mongoose_1.default.model('BalanceOfTrade', balanceOfTradeSchema);
exports.BalanceOfTrade = BalanceOfTrade;
const GovernmentDebtToGDP = mongoose_1.default.model('GovernmentDebtToGDP', governmentDebtToGDPSchema);
exports.GovernmentDebtToGDP = GovernmentDebtToGDP;
const GovernmentDebtValue = mongoose_1.default.model('GovernmentDebtValue', governmentDebtValueSchema);
exports.GovernmentDebtValue = GovernmentDebtValue;
const GovernmentBudgetValue = mongoose_1.default.model('GovernmentBudgetValue', governmentBudgetValueSchema);
exports.GovernmentBudgetValue = GovernmentBudgetValue;
const GovernmentRevenues = mongoose_1.default.model('GovernmentRevenues', governmentRevenuesSchema);
exports.GovernmentRevenues = GovernmentRevenues;
const FiscalExpenditure = mongoose_1.default.model('FiscalExpenditure', fiscalExpenditureSchema);
exports.FiscalExpenditure = FiscalExpenditure;
const GovernmentSpending = mongoose_1.default.model('GovernmentSpending', governmentSpendingSchema);
exports.GovernmentSpending = GovernmentSpending;
//# sourceMappingURL=economic.model.js.map