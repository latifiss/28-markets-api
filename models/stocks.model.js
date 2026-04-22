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
exports.PriceHistory = exports.Holders = exports.Financial = exports.Earnings = exports.Dividends = exports.Statistics = exports.Profile = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const aboutSchema = new mongoose_1.Schema({
    company_name: { type: String, required: true },
    slug: { type: String, required: true },
    year_founded: { type: String, required: true },
    industry: { type: String, required: true },
    isin_symbol: { type: String },
    website: { type: String },
    headquaters: { type: String, required: true },
    exchange_symbol: { type: String, required: true, default: 'GSE' },
    ticker_symbol: { type: String, required: true },
    unique_symbol: { type: String, required: true },
    company_description: { type: String, required: true },
    number_of_employees: { type: String },
    country: { type: String, required: true, default: 'Ghana' },
    currency: { type: String, required: true, default: 'GHS' },
    chief_executive_officer: { type: String },
}, { _id: false });
const ProfileSchema = new mongoose_1.Schema({
    company_id: { type: String, required: true, unique: true },
    about: aboutSchema,
    shares: {
        exchange_listed_name: { type: String },
        exchange_code: { type: String },
        exchange_slug: { type: String },
        date_listed: { type: String },
        authorized_shares: { type: String },
        issued_shares: { type: String },
    },
}, { timestamps: true });
const keyStatsSchema = new mongoose_1.Schema({
    market_capitalization: { type: String },
    price_earning_ratio: { type: Number },
    volume: { type: Number },
    revenue: { type: String },
    revenue_currency: { type: String, default: 'GHS' },
    netIncome: { type: String },
    netIncome_currency: { type: String, default: 'GHS' },
    dividend_yield: { type: Number },
    dividend_per_share: { type: Number },
    earnings_per_share: { type: Number },
    shares_outstanding: { type: String },
    fifty_two_week_high: { type: Number },
    fifty_two_week_high_date: { type: String },
    fifty_two_week_low: { type: Number },
    fifty_two_week_low_date: { type: String },
    bid_size: { type: String },
    bid_price: { type: String },
    ask_size: { type: String },
    ask_price: { type: String },
    last_trade_price: { type: String },
    last_trade_volume: { type: String },
    trade_value: { type: String },
    open: { type: Number },
    close: { type: Number },
    high: { type: Number },
    low: { type: Number },
    percentage_change: { type: Number },
    currency: { type: String, required: true, default: 'GHS' },
    current_price: { type: String, required: true },
    status: {
        type: String,
        enum: ['open', 'suspended', 'closed'],
        default: 'open',
    },
    status_message: {
        type: String,
        default: function () {
            switch (this.status) {
                case 'open':
                    return 'Market open';
                case 'suspended':
                    return 'Market suspended';
                case 'closed':
                    return 'Market closed';
                default:
                    return 'Market open';
            }
        },
    },
}, { _id: false });
const returnsSchema = new mongoose_1.Schema({
    five_days_returns: { type: Number },
    one_month_returns: { type: Number },
    three_months_returns: { type: Number },
    one_year_returns: { type: Number },
}, { _id: false });
const StatisticsSchema = new mongoose_1.Schema({
    company_id: { type: String, required: true, unique: true },
    company_name: { type: String, required: true },
    ticker_symbol: { type: String, required: true },
    key_statistics: keyStatsSchema,
    returns: returnsSchema,
    growth_valuation: {
        earnings_per_share: { type: Number },
        price_earning_ratio: { type: Number },
        dividend_per_share: { type: Number },
        dividend_yield: { type: String },
        shares_outstanding: { type: String },
        market_capitalization: { type: String },
    },
    key_stats_history: [
        {
            date: { type: Date, required: true, default: Date.now },
            market_capitalization: { type: String },
            price_earning_ratio: { type: Number },
            current_price: { type: String },
            volume: { type: Number },
            dividend_yield: { type: Number },
            earnings_per_share: { type: Number },
        },
    ],
    last_updated: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });
StatisticsSchema.methods.addToKeyStatsHistory = function () {
    if (this.key_stats_history && this.key_statistics) {
        this.key_stats_history.push({
            date: new Date(),
            market_capitalization: this.key_statistics.market_capitalization,
            price_earning_ratio: this.key_statistics.price_earning_ratio,
            current_price: this.key_statistics.current_price,
            volume: this.key_statistics.volume,
            dividend_yield: this.key_statistics.dividend_yield,
            earnings_per_share: this.key_statistics.earnings_per_share,
        });
        if (this.key_stats_history.length > 100) {
            this.key_stats_history = this.key_stats_history.slice(-100);
        }
    }
};
StatisticsSchema.pre('save', function () {
    if (this.isModified('key_statistics')) {
        this.addToKeyStatsHistory();
        this.last_updated = new Date();
    }
});
StatisticsSchema.pre('findOneAndUpdate', function () {
    this.set({ last_updated: new Date() });
});
const PriceHistorySchema = new mongoose_1.Schema({
    company_id: {
        type: String,
        required: true,
        unique: true,
    },
    company_name: {
        type: String,
        required: true,
    },
    ticker_symbol: {
        type: String,
        required: true,
    },
    history: [
        {
            date: {
                type: Date,
                required: true,
            },
            price: {
                type: String,
                required: true,
            },
        },
    ],
}, {
    timestamps: true,
});
PriceHistorySchema.index({ company_id: 1, 'history.date': -1 });
PriceHistorySchema.index({ ticker_symbol: 1, 'history.date': -1 });
const dividendHistorySchema = new mongoose_1.Schema({
    payment_date: { type: Date, required: true },
    declaration_date: { type: Date },
    record_date: { type: Date },
    ex_dividend_date: { type: Date },
    amount: { type: Number, required: true },
    amount_currency: { type: String, required: true },
    dividend_type: {
        type: String,
        enum: ['regular', 'special', 'extra', 'interim', 'final', 'other'],
        default: 'regular',
    },
    fiscal_year: { type: Number },
    added_to_history: { type: Date, default: Date.now },
}, { _id: false });
const DividendsSchema = new mongoose_1.Schema({
    company_id: { type: String, required: true, unique: true },
    company_name: { type: String, required: true },
    ticker_symbol: { type: String, required: true },
    events: {
        next_dividend_pay_date: { type: Date },
        last_dividend_pay_date: { type: Date },
        dividend_growth: { type: String },
    },
    dividend_history: [dividendHistorySchema],
    summary: {
        annual_dividend: { type: Number },
        dividend_frequency: {
            type: String,
            enum: [
                'quarterly',
                'semi-annual',
                'annual',
                'monthly',
                'irregular',
                'none',
            ],
        },
        years_consecutive_increase: { type: Number },
        average_yield_5yr: { type: Number },
    },
    last_updated: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });
DividendsSchema.methods.addDividendToHistory = function () {
    var _a;
    if (this.dividend_history && this.summary && this.summary.annual_dividend) {
        const now = new Date();
        const currentYear = now.getFullYear();
        const existingEntry = this.dividend_history.find((entry) => entry.fiscal_year === currentYear);
        if (!existingEntry) {
            this.dividend_history.push({
                payment_date: ((_a = this.events) === null || _a === void 0 ? void 0 : _a.last_dividend_pay_date) || now,
                declaration_date: now,
                amount: this.summary.annual_dividend,
                amount_currency: 'GHS',
                dividend_type: 'regular',
                fiscal_year: currentYear,
                added_to_history: now,
            });
            if (this.dividend_history.length > 20) {
                this.dividend_history = this.dividend_history.slice(-20);
            }
        }
    }
};
DividendsSchema.pre('save', function (next) {
    if (this.isModified('summary.annual_dividend')) {
        this.addDividendToHistory();
        this.last_updated = new Date();
    }
});
DividendsSchema.pre('findOneAndUpdate', function (next) {
    this.set({ last_updated: new Date() });
});
const earningsHistorySchema = new mongoose_1.Schema({
    period: { type: String, required: true },
    period_type: {
        type: String,
        enum: ['quarterly', 'annual', 'semi-annual'],
        required: true,
    },
    report_date: { type: Date, required: true },
    earnings_per_share: { type: Number },
    revenue: { type: Number },
    revenue_currency: { type: String },
    net_income: { type: Number },
    net_income_currency: { type: String },
    eps_estimate: { type: Number },
    revenue_estimate: { type: Number },
    surprise_percentage: { type: Number },
    added_to_history: { type: Date, default: Date.now },
}, { _id: false });
const EarningsSchema = new mongoose_1.Schema({
    company_id: { type: String, required: true, unique: true },
    company_name: { type: String, required: true },
    ticker_symbol: { type: String, required: true },
    events: {
        next_earnings_date: { type: Date },
        next_earnings_estimated_eps: { type: Number },
        next_earnings_estimated_revenue: { type: Number },
    },
    earnings_history: [earningsHistorySchema],
    annual_net_income_history: [
        {
            for_year: { type: Number, required: true },
            value: { type: Number, required: true },
            value_currency: { type: String, required: true },
            added_to_history: { type: Date, default: Date.now },
        },
    ],
    quarterly_net_income_history: [
        {
            for_quarter: { type: String, required: true },
            for_year: { type: Number, required: true },
            value: { type: Number, required: true },
            value_currency: { type: String, required: true },
            added_to_history: { type: Date, default: Date.now },
        },
    ],
    last_updated: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });
EarningsSchema.methods.addEarningsToHistory = function (periodType = 'quarterly') {
    const now = new Date();
    const currentYear = now.getFullYear();
    const quarter = Math.floor((now.getMonth() + 3) / 3);
    const quarterStr = `Q${quarter}`;
    if (periodType === 'annual') {
        if (this.events && this.events.next_earnings_estimated_eps) {
            const existingAnnualEntry = this.annual_net_income_history.find((entry) => entry.for_year === currentYear);
            if (!existingAnnualEntry) {
                this.annual_net_income_history.push({
                    for_year: currentYear,
                    value: this.events.next_earnings_estimated_eps,
                    value_currency: 'GHS',
                    added_to_history: now,
                });
                if (this.annual_net_income_history.length > 10) {
                    this.annual_net_income_history =
                        this.annual_net_income_history.slice(-10);
                }
            }
        }
    }
    else {
        if (this.events && this.events.next_earnings_estimated_eps) {
            const existingQuarterlyEntry = this.quarterly_net_income_history.find((entry) => entry.for_quarter === quarterStr && entry.for_year === currentYear);
            if (!existingQuarterlyEntry) {
                this.quarterly_net_income_history.push({
                    for_quarter: quarterStr,
                    for_year: currentYear,
                    value: this.events.next_earnings_estimated_eps,
                    value_currency: 'GHS',
                    added_to_history: now,
                });
                if (this.quarterly_net_income_history.length > 40) {
                    this.quarterly_net_income_history =
                        this.quarterly_net_income_history.slice(-40);
                }
            }
        }
    }
};
EarningsSchema.pre('save', function (next) {
    if (this.isModified('events.next_earnings_estimated_eps') ||
        this.isModified('events.next_earnings_estimated_revenue')) {
        this.addEarningsToHistory('quarterly');
        this.last_updated = new Date();
    }
});
EarningsSchema.pre('findOneAndUpdate', function (next) {
    this.set({ last_updated: new Date() });
});
const financialStatementSchema = new mongoose_1.Schema({
    period: { type: String, required: true },
    period_type: {
        type: String,
        enum: ['quarterly', 'annual'],
        required: true,
    },
    statement_date: { type: Date },
    revenue: { type: Number },
    cost_of_goods_sold: { type: Number },
    gross_profit: { type: Number },
    operating_expenses: { type: Number },
    operating_income: { type: Number },
    interest_expense: { type: Number },
    taxes: { type: Number },
    net_income: { type: Number },
    total_assets: { type: Number },
    total_liabilities: { type: Number },
    total_equity: { type: Number },
    cash_and_equivalents: { type: Number },
    operating_cash_flow: { type: Number },
    investing_cash_flow: { type: Number },
    financing_cash_flow: { type: Number },
    free_cash_flow: { type: Number },
    gross_margin: { type: Number },
    operating_margin: { type: Number },
    net_margin: { type: Number },
    current_ratio: { type: Number },
    debt_to_equity: { type: Number },
    currency: { type: String, required: true },
    added_to_history: { type: Date, default: Date.now },
}, { _id: false });
const FinancialSchema = new mongoose_1.Schema({
    company_id: { type: String, required: true, unique: true },
    company_name: { type: String, required: true },
    ticker_symbol: { type: String, required: true },
    annual_revenue_history: [
        {
            for_year: { type: Number, required: true },
            value: { type: Number, required: true },
            value_currency: { type: String, required: true },
            added_to_history: { type: Date, default: Date.now },
        },
    ],
    quarterly_revenue_history: [
        {
            for_quarter: { type: String, required: true },
            for_year: { type: Number, required: true },
            value: { type: Number, required: true },
            value_currency: { type: String, required: true },
            added_to_history: { type: Date, default: Date.now },
        },
    ],
    annual_net_margin_history: [
        {
            for_year: { type: Number, required: true },
            value: { type: Number, required: true },
            added_to_history: { type: Date, default: Date.now },
        },
    ],
    quarterly_net_margin_history: [
        {
            for_quarter: { type: String, required: true },
            for_year: { type: Number, required: true },
            value: { type: Number, required: true },
            added_to_history: { type: Date, default: Date.now },
        },
    ],
    annual_revenue_breakdown: [
        {
            for_year: { type: Number },
            title: { type: String },
            title_value: { type: Number },
            value_currency: { type: String },
            added_to_history: { type: Date, default: Date.now },
        },
    ],
    quarterly_revenue_breakdown: [
        {
            for_quarter: { type: String },
            for_year: { type: Number },
            title: { type: String },
            title_value: { type: Number },
            value_currency: { type: String },
            added_to_history: { type: Date, default: Date.now },
        },
    ],
    annual_revenue_to_profit_conversion: {
        revenue: { type: Number },
        cogs: { type: Number },
        gross_profit: { type: Number },
        operating_expenses: { type: Number },
        operating_income: { type: Number },
        non_operating_income_expenses: { type: Number },
        taxes_and_other: { type: Number },
        net_income: { type: Number },
    },
    quarterly_revenue_to_profit_conversion: {
        revenue: { type: Number },
        cogs: { type: Number },
        gross_profit: { type: Number },
        operating_expenses: { type: Number },
        operating_income: { type: Number },
        non_operating_income_expenses: { type: Number },
        taxes_and_other: { type: Number },
        net_income: { type: Number },
    },
    annual_debt_level_and_coverage: [
        {
            for_year: { type: Number },
            debt_value: { type: Number },
            free_cash_flow_value: { type: Number },
            cash_and_equivalents_value: { type: Number },
            value_currency: { type: String },
            added_to_history: { type: Date, default: Date.now },
        },
    ],
    quarterly_debt_level_and_coverage: [
        {
            for_quarter: { type: String },
            for_year: { type: Number },
            debt_value: { type: Number },
            free_cash_flow_value: { type: Number },
            cash_and_equivalents_value: { type: Number },
            value_currency: { type: String },
            added_to_history: { type: Date, default: Date.now },
        },
    ],
    financial_statements: [financialStatementSchema],
    financial_summary: {
        latest_revenue: { type: Number },
        latest_net_income: { type: Number },
        total_assets: { type: Number },
        total_debt: { type: Number },
        profit_margin: { type: Number },
        roe: { type: Number },
        roa: { type: Number },
        as_of_date: { type: Date },
    },
    last_updated: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });
FinancialSchema.methods.addRevenueToHistory = function (periodType = 'quarterly') {
    const now = new Date();
    const currentYear = now.getFullYear();
    const quarter = Math.floor((now.getMonth() + 3) / 3);
    const quarterStr = `Q${quarter}`;
    if (this.financial_summary && this.financial_summary.latest_revenue) {
        if (periodType === 'annual') {
            const existingAnnualEntry = this.annual_revenue_history.find((entry) => entry.for_year === currentYear);
            if (!existingAnnualEntry) {
                this.annual_revenue_history.push({
                    for_year: currentYear,
                    value: this.financial_summary.latest_revenue,
                    value_currency: 'GHS',
                    added_to_history: now,
                });
                if (this.annual_revenue_history.length > 10) {
                    this.annual_revenue_history = this.annual_revenue_history.slice(-10);
                }
            }
        }
        else {
            const existingQuarterlyEntry = this.quarterly_revenue_history.find((entry) => entry.for_quarter === quarterStr && entry.for_year === currentYear);
            if (!existingQuarterlyEntry) {
                this.quarterly_revenue_history.push({
                    for_quarter: quarterStr,
                    for_year: currentYear,
                    value: this.financial_summary.latest_revenue,
                    value_currency: 'GHS',
                    added_to_history: now,
                });
                if (this.quarterly_revenue_history.length > 40) {
                    this.quarterly_revenue_history =
                        this.quarterly_revenue_history.slice(-40);
                }
            }
        }
    }
};
FinancialSchema.methods.addNetMarginToHistory = function (periodType = 'quarterly') {
    const now = new Date();
    const currentYear = now.getFullYear();
    const quarter = Math.floor((now.getMonth() + 3) / 3);
    const quarterStr = `Q${quarter}`;
    if (this.financial_summary && this.financial_summary.profit_margin) {
        if (periodType === 'annual') {
            const existingAnnualEntry = this.annual_net_margin_history.find((entry) => entry.for_year === currentYear);
            if (!existingAnnualEntry) {
                this.annual_net_margin_history.push({
                    for_year: currentYear,
                    value: this.financial_summary.profit_margin,
                    added_to_history: now,
                });
                if (this.annual_net_margin_history.length > 10) {
                    this.annual_net_margin_history =
                        this.annual_net_margin_history.slice(-10);
                }
            }
        }
        else {
            const existingQuarterlyEntry = this.quarterly_net_margin_history.find((entry) => entry.for_quarter === quarterStr && entry.for_year === currentYear);
            if (!existingQuarterlyEntry) {
                this.quarterly_net_margin_history.push({
                    for_quarter: quarterStr,
                    for_year: currentYear,
                    value: this.financial_summary.profit_margin,
                    added_to_history: now,
                });
                if (this.quarterly_net_margin_history.length > 40) {
                    this.quarterly_net_margin_history =
                        this.quarterly_net_margin_history.slice(-40);
                }
            }
        }
    }
};
FinancialSchema.methods.addDebtToHistory = function (periodType = 'quarterly') {
    const now = new Date();
    const currentYear = now.getFullYear();
    const quarter = Math.floor((now.getMonth() + 3) / 3);
    const quarterStr = `Q${quarter}`;
    if (this.financial_summary && this.financial_summary.total_debt) {
        if (periodType === 'annual') {
            const existingAnnualEntry = this.annual_debt_level_and_coverage.find((entry) => entry.for_year === currentYear);
            if (!existingAnnualEntry) {
                this.annual_debt_level_and_coverage.push({
                    for_year: currentYear,
                    debt_value: this.financial_summary.total_debt,
                    free_cash_flow_value: 0,
                    cash_and_equivalents_value: 0,
                    value_currency: 'GHS',
                    added_to_history: now,
                });
                if (this.annual_debt_level_and_coverage.length > 10) {
                    this.annual_debt_level_and_coverage =
                        this.annual_debt_level_and_coverage.slice(-10);
                }
            }
        }
        else {
            const existingQuarterlyEntry = this.quarterly_debt_level_and_coverage.find((entry) => entry.for_quarter === quarterStr && entry.for_year === currentYear);
            if (!existingQuarterlyEntry) {
                this.quarterly_debt_level_and_coverage.push({
                    for_quarter: quarterStr,
                    for_year: currentYear,
                    debt_value: this.financial_summary.total_debt,
                    free_cash_flow_value: 0,
                    cash_and_equivalents_value: 0,
                    value_currency: 'GHS',
                    added_to_history: now,
                });
                if (this.quarterly_debt_level_and_coverage.length > 40) {
                    this.quarterly_debt_level_and_coverage =
                        this.quarterly_debt_level_and_coverage.slice(-40);
                }
            }
        }
    }
};
FinancialSchema.pre('save', function (next) {
    if (this.isModified('financial_summary.latest_revenue')) {
        this.addRevenueToHistory('quarterly');
    }
    if (this.isModified('financial_summary.profit_margin')) {
        this.addNetMarginToHistory('quarterly');
    }
    if (this.isModified('financial_summary.total_debt')) {
        this.addDebtToHistory('quarterly');
    }
    if (this.isModified()) {
        this.last_updated = new Date();
    }
});
FinancialSchema.pre('findOneAndUpdate', function (next) {
    this.set({ last_updated: new Date() });
});
const shareholderSchema = new mongoose_1.Schema({
    holder_name: { type: String },
    holder_type: {
        type: String,
        enum: [
            'institution',
            'insider',
            'mutual_fund',
            'etf',
            'other',
            'pension_fund',
        ],
    },
    shares_held: { type: Number },
    shares_percent: { type: Number },
    date_reported: { type: Date },
    change: { type: Number },
    change_percent: { type: Number },
    market_value: { type: Number },
    market_value_currency: { type: String },
}, { _id: false });
const institutionalHolderSchema = new mongoose_1.Schema({
    institution_name: { type: String },
    shares_held: { type: Number },
    shares_percent: { type: Number },
    date_reported: { type: Date },
}, { _id: false });
const insiderTransactionSchema = new mongoose_1.Schema({
    insider_name: { type: String },
    position: { type: String },
    transaction_date: { type: Date },
    transaction_type: {
        type: String,
        enum: ['buy', 'sell', 'option_exercise', 'Grant/Award', 'other'],
        required: true,
    },
    shares: { type: Number },
    price_per_share: { type: Number },
    total_value: { type: Number },
}, { _id: false });
const HoldersSchema = new mongoose_1.Schema({
    company_id: { type: String, required: true, unique: true },
    company_name: { type: String, required: true },
    ticker_symbol: { type: String, required: true },
    ownership_summary: {
        percent_institutions: { type: Number },
        percent_insiders: { type: Number },
        percent_public: { type: Number },
        shares_float: { type: Number },
        shares_outstanding: { type: Number },
        as_of_date: { type: Date },
        percent_shares_held_by_all_insiders: { type: Number },
        percent_shares_held_by_institutions: { type: Number },
        percent_float_held_by_institutions: { type: Number },
        number_of_institutions: { type: Number },
        calculated_percent_public: {
            type: Number,
            default: function () {
                const insiders = this.percent_shares_held_by_all_insiders || this.percent_insiders || 0;
                const institutions = this.percent_shares_held_by_institutions || this.percent_institutions || 0;
                return Math.max(0, 100 - (insiders + institutions));
            },
        },
    },
    top_institutional_holders: [institutionalHolderSchema],
    top_mutual_fund_holders: [shareholderSchema],
    top_etf_holders: [shareholderSchema],
    top_insider_holders: [shareholderSchema],
    recent_insider_transactions: [insiderTransactionSchema],
    institutional_ownership_history: [
        {
            date: { type: Date },
            percent_institutions: { type: Number },
            number_institutions: { type: Number },
            percent_shares_held_by_all_insiders: { type: Number },
            percent_shares_held_by_institutions: { type: Number },
            percent_float_held_by_institutions: { type: Number },
            added_to_history: { type: Date, default: Date.now },
        },
    ],
    last_updated: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });
HoldersSchema.methods.addOwnershipToHistory = function () {
    const now = new Date();
    if (this.ownership_summary) {
        this.institutional_ownership_history.push({
            date: now,
            percent_institutions: this.ownership_summary.percent_institutions,
            number_institutions: this.ownership_summary.number_of_institutions,
            percent_shares_held_by_all_insiders: this.ownership_summary.percent_shares_held_by_all_insiders,
            percent_shares_held_by_institutions: this.ownership_summary.percent_shares_held_by_institutions,
            percent_float_held_by_institutions: this.ownership_summary.percent_float_held_by_institutions,
            added_to_history: now,
        });
        if (this.institutional_ownership_history.length > 50) {
            this.institutional_ownership_history =
                this.institutional_ownership_history.slice(-50);
        }
    }
};
HoldersSchema.pre('save', function (next) {
    if (this.isModified('ownership_summary')) {
        this.addOwnershipToHistory();
        this.last_updated = new Date();
    }
});
HoldersSchema.pre('findOneAndUpdate', function (next) {
    this.set({ last_updated: new Date() });
});
const Profile = mongoose_1.default.model('Profile', ProfileSchema);
exports.Profile = Profile;
const Statistics = mongoose_1.default.model('Statistics', StatisticsSchema);
exports.Statistics = Statistics;
const Dividends = mongoose_1.default.model('Dividends', DividendsSchema);
exports.Dividends = Dividends;
const Earnings = mongoose_1.default.model('Earnings', EarningsSchema);
exports.Earnings = Earnings;
const Financial = mongoose_1.default.model('Financial', FinancialSchema);
exports.Financial = Financial;
const Holders = mongoose_1.default.model('Holders', HoldersSchema);
exports.Holders = Holders;
const PriceHistory = mongoose_1.default.model('PriceHistory', PriceHistorySchema);
exports.PriceHistory = PriceHistory;
//# sourceMappingURL=stocks.model.js.map