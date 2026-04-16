import mongoose, { Schema, Document, Model } from 'mongoose';

interface IMonthlyHistory {
  month: 'Jan' | 'Feb' | 'Mar' | 'Apr' | 'May' | 'Jun' | 'Jul' | 'Aug' | 'Sep' | 'Oct' | 'Nov' | 'Dec';
  year: number;
  value: number;
}

interface IQuarterlyHistory {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  year: number;
  value: number;
}

interface IAnnualHistory {
  year: number;
  value: number;
}

interface IDebtHistory {
  month: string;
  value: number;
}

interface IGDPValueHistory {
  month: string;
  year: number;
  value: number;
}

interface IInterestRateHistory {
  date: Date;
  value: number;
  decision: string;
}

interface IBalanceOfTradeHistory {
  month: string;
  year: number;
  balance: number;
  exports: number;
  imports: number;
}

interface IBudgetHistory {
  month: string;
  year: number;
  value: number;
  revenue: number;
  expenditure: number;
}

interface IGDPGrowthQuarterly extends Document {
  current_value: number;
  previous_value?: number;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  year: number;
  forecast?: number;
  target_min: number;
  target_max: number;
  source?: string;
  historical_data: IQuarterlyHistory[];
  last_updated: Date;
  createdAt: Date;
  updatedAt: Date;
  formatted_value: string;
  percentage_change: number;
  is_within_target: boolean;
  addToHistory(): IGDPGrowthQuarterly;
}

interface IGDPGrowthAnnual extends Document {
  current_value: number;
  previous_value?: number;
  year: number;
  forecast?: number;
  target_min: number;
  target_max: number;
  source?: string;
  historical_data: IAnnualHistory[];
  last_updated: Date;
  createdAt: Date;
  updatedAt: Date;
  formatted_value: string;
  percentage_change: number;
  is_within_target: boolean;
  addToHistory(): IGDPGrowthAnnual;
}

interface IGovernmentGDPValue extends Document {
  current_value: number;
  previous_value?: number;
  current_month?: 'Jan' | 'Feb' | 'Mar' | 'Apr' | 'May' | 'Jun' | 'Jul' | 'Aug' | 'Sep' | 'Oct' | 'Nov' | 'Dec';
  current_year: number;
  gdp_history: IGDPValueHistory[];
  last_updated: Date;
  source?: string;
  createdAt: Date;
  updatedAt: Date;
  formatted_value: string;
  percentage_change: number;
  addToHistory(): IGovernmentGDPValue;
}

interface IInterestRate extends Document {
  current_value: number;
  previous_value?: number;
  effective_date: Date;
  next_meeting_date?: Date;
  forecast?: number;
  target_range_min: number;
  target_range_max: number;
  source?: string;
  historical_data: IInterestRateHistory[];
  last_updated: Date;
  createdAt: Date;
  updatedAt: Date;
  formatted_value: string;
  percentage_change: number;
  is_within_target: boolean;
  addToHistory(): IInterestRate;
}

interface IInflationRate extends Document {
  current_value: number;
  previous_value?: number;
  month: 'Jan' | 'Feb' | 'Mar' | 'Apr' | 'May' | 'Jun' | 'Jul' | 'Aug' | 'Sep' | 'Oct' | 'Nov' | 'Dec';
  year: number;
  forecast?: number;
  target_range_min: number;
  target_range_max: number;
  source?: string;
  historical_data: IMonthlyHistory[];
  last_updated: Date;
  createdAt: Date;
  updatedAt: Date;
  formatted_value: string;
  percentage_change: number;
  is_within_target: boolean;
  addToHistory(): IInflationRate;
}

interface IUnemploymentRate extends Document {
  current_value: number;
  previous_value?: number;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  year: number;
  forecast?: number;
  target: number;
  source?: string;
  historical_data: IQuarterlyHistory[];
  last_updated: Date;
  createdAt: Date;
  updatedAt: Date;
  formatted_value: string;
  percentage_change: number;
  is_below_target: boolean;
  addToHistory(): IUnemploymentRate;
}

interface IBalanceOfTrade extends Document {
  current_balance: number;
  previous_balance?: number;
  month: 'Jan' | 'Feb' | 'Mar' | 'Apr' | 'May' | 'Jun' | 'Jul' | 'Aug' | 'Sep' | 'Oct' | 'Nov' | 'Dec';
  year: number;
  exports_value: number;
  imports_value: number;
  currency: string;
  source?: string;
  historical_data: IBalanceOfTradeHistory[];
  last_updated: Date;
  createdAt: Date;
  updatedAt: Date;
  formatted_balance: string;
  is_surplus: boolean;
  balance_change: number;
  addToHistory(): IBalanceOfTrade;
}

interface IGovernmentDebtToGDP extends Document {
  current_value: number;
  previous_value?: number;
  year: number;
  gdp_value: number;
  total_debt_value: number;
  target_max: number;
  source?: string;
  historical_data: IAnnualHistory[];
  last_updated: Date;
  createdAt: Date;
  updatedAt: Date;
  formatted_value: string;
  percentage_change: number;
  is_below_target: boolean;
  addToHistory(): IGovernmentDebtToGDP;
}

interface IGovernmentDebtValue extends Document {
  current_value: number;
  current_month?: 'Jan' | 'Feb' | 'Mar' | 'Apr' | 'May' | 'Jun' | 'Jul' | 'Aug' | 'Sep' | 'Oct' | 'Nov' | 'Dec';
  current_year: number;
  debt_history: IDebtHistory[];
  last_updated: Date;
  source?: string;
  createdAt: Date;
  updatedAt: Date;
  formatted_value: string;
  addToHistory(): IGovernmentDebtValue;
}

interface IGovernmentBudgetValue extends Document {
  current_value: number;
  previous_value?: number;
  month: 'Jan' | 'Feb' | 'Mar' | 'Apr' | 'May' | 'Jun' | 'Jul' | 'Aug' | 'Sep' | 'Oct' | 'Nov' | 'Dec';
  year: number;
  revenue_value: number;
  expenditure_value: number;
  currency: string;
  source?: string;
  historical_data: IBudgetHistory[];
  last_updated: Date;
  createdAt: Date;
  updatedAt: Date;
  formatted_value: string;
  is_surplus: boolean;
  balance_change: number;
  addToHistory(): IGovernmentBudgetValue;
}

interface IGovernmentRevenues extends Document {
  current_value: number;
  previous_value?: number;
  month: 'Jan' | 'Feb' | 'Mar' | 'Apr' | 'May' | 'Jun' | 'Jul' | 'Aug' | 'Sep' | 'Oct' | 'Nov' | 'Dec';
  year: number;
  currency: string;
  source?: string;
  historical_data: IMonthlyHistory[];
  last_updated: Date;
  createdAt: Date;
  updatedAt: Date;
  formatted_value: string;
  percentage_change: number;
  addToHistory(): IGovernmentRevenues;
}

interface IFiscalExpenditure extends Document {
  current_value: number;
  previous_value?: number;
  month: 'Jan' | 'Feb' | 'Mar' | 'Apr' | 'May' | 'Jun' | 'Jul' | 'Aug' | 'Sep' | 'Oct' | 'Nov' | 'Dec';
  year: number;
  currency: string;
  source?: string;
  historical_data: IMonthlyHistory[];
  last_updated: Date;
  createdAt: Date;
  updatedAt: Date;
  formatted_value: string;
  percentage_change: number;
  addToHistory(): IFiscalExpenditure;
}

interface IGovernmentSpending extends Document {
  current_value: number;
  previous_value?: number;
  year: number;
  currency: string;
  source?: string;
  historical_data: IAnnualHistory[];
  last_updated: Date;
  createdAt: Date;
  updatedAt: Date;
  formatted_value: string;
  percentage_change: number;
  addToHistory(): IGovernmentSpending;
}

interface IGDPGrowthQuarterlyModel extends Model<IGDPGrowthQuarterly> {
  findLatest(): Promise<IGDPGrowthQuarterly | null>;
  findByQuarterAndYear(quarter: string, year: number): Promise<IGDPGrowthQuarterly | null>;
}

interface IGDPGrowthAnnualModel extends Model<IGDPGrowthAnnual> {
  findLatest(): Promise<IGDPGrowthAnnual | null>;
  findByYear(year: number): Promise<IGDPGrowthAnnual | null>;
}

interface IGovernmentGDPValueModel extends Model<IGovernmentGDPValue> {
  findLatest(): Promise<IGovernmentGDPValue | null>;
}

interface IInterestRateModel extends Model<IInterestRate> {
  findLatest(): Promise<IInterestRate | null>;
}

interface IInflationRateModel extends Model<IInflationRate> {
  findLatest(): Promise<IInflationRate | null>;
  findByMonthAndYear(month: string, year: number): Promise<IInflationRate | null>;
}

interface IUnemploymentRateModel extends Model<IUnemploymentRate> {
  findLatest(): Promise<IUnemploymentRate | null>;
  findByQuarterAndYear(quarter: string, year: number): Promise<IUnemploymentRate | null>;
}

interface IBalanceOfTradeModel extends Model<IBalanceOfTrade> {
  findLatest(): Promise<IBalanceOfTrade | null>;
  findByMonthAndYear(month: string, year: number): Promise<IBalanceOfTrade | null>;
}

interface IGovernmentDebtToGDPModel extends Model<IGovernmentDebtToGDP> {
  findLatest(): Promise<IGovernmentDebtToGDP | null>;
  findByYear(year: number): Promise<IGovernmentDebtToGDP | null>;
}

interface IGovernmentDebtValueModel extends Model<IGovernmentDebtValue> {
  findLatest(): Promise<IGovernmentDebtValue | null>;
}

interface IGovernmentBudgetValueModel extends Model<IGovernmentBudgetValue> {
  findLatest(): Promise<IGovernmentBudgetValue | null>;
}

interface IGovernmentRevenuesModel extends Model<IGovernmentRevenues> {
  findLatest(): Promise<IGovernmentRevenues | null>;
}

interface IFiscalExpenditureModel extends Model<IFiscalExpenditure> {
  findLatest(): Promise<IFiscalExpenditure | null>;
}

interface IGovernmentSpendingModel extends Model<IGovernmentSpending> {
  findLatest(): Promise<IGovernmentSpending | null>;
}

const monthlyHistorySchema = new Schema<IMonthlyHistory>(
  {
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
  },
  { _id: false }
);

const quarterlyHistorySchema = new Schema<IQuarterlyHistory>(
  {
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
  },
  { _id: false }
);

const annualHistorySchema = new Schema<IAnnualHistory>(
  {
    year: {
      type: Number,
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const debtHistorySchema = new Schema<IDebtHistory>(
  {
    month: {
      type: String,
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const gdpValueHistorySchema = new Schema<IGDPValueHistory>(
  {
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
  },
  { _id: false }
);

const gdpGrowthQuarterlySchema = new Schema<IGDPGrowthQuarterly>(
  {
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

gdpGrowthQuarterlySchema.index({ year: 1, quarter: 1 }, { unique: true });
gdpGrowthQuarterlySchema.index({ 'historical_data.year': -1, 'historical_data.quarter': -1 });

gdpGrowthQuarterlySchema.virtual('formatted_value').get(function(this: IGDPGrowthQuarterly) {
  return `${this.current_value.toFixed(2)}%`;
});

gdpGrowthQuarterlySchema.virtual('percentage_change').get(function(this: IGDPGrowthQuarterly) {
  if (!this.previous_value || this.previous_value === 0) return 0;
  return ((this.current_value - this.previous_value) / Math.abs(this.previous_value)) * 100;
});

gdpGrowthQuarterlySchema.virtual('is_within_target').get(function(this: IGDPGrowthQuarterly) {
  return this.current_value >= this.target_min && this.current_value <= this.target_max;
});

gdpGrowthQuarterlySchema.methods.addToHistory = function(this: IGDPGrowthQuarterly) {
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

gdpGrowthQuarterlySchema.statics.findLatest = function() {
  return this.findOne().sort({ year: -1, quarter: -1 });
};

gdpGrowthQuarterlySchema.statics.findByQuarterAndYear = function(quarter: string, year: number) {
  return this.findOne({ quarter, year });
};

const gdpGrowthAnnualSchema = new Schema<IGDPGrowthAnnual>(
  {
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

gdpGrowthAnnualSchema.index({ year: 1 }, { unique: true });
gdpGrowthAnnualSchema.index({ 'historical_data.year': -1, 'historical_data.quarter': -1 });

gdpGrowthAnnualSchema.virtual('formatted_value').get(function(this: IGDPGrowthAnnual) {
  return `${this.current_value.toFixed(2)}%`;
});

gdpGrowthAnnualSchema.virtual('percentage_change').get(function(this: IGDPGrowthAnnual) {
  if (!this.previous_value || this.previous_value === 0) return 0;
  return ((this.current_value - this.previous_value) / Math.abs(this.previous_value)) * 100;
});

gdpGrowthAnnualSchema.virtual('is_within_target').get(function(this: IGDPGrowthAnnual) {
  return this.current_value >= this.target_min && this.current_value <= this.target_max;
});

gdpGrowthAnnualSchema.methods.addToHistory = function(this: IGDPGrowthAnnual) {
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

gdpGrowthAnnualSchema.statics.findLatest = function() {
  return this.findOne().sort({ year: -1 });
};

gdpGrowthAnnualSchema.statics.findByYear = function(year: number) {
  return this.findOne({ year });
};

const governmentGDPValueSchema = new Schema<IGovernmentGDPValue>(
  {
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

governmentGDPValueSchema.index({ current_year: 1, current_month: 1 }, { unique: false });

governmentGDPValueSchema.virtual('formatted_value').get(function(this: IGovernmentGDPValue) {
  if (this.current_value >= 1000000000) {
    return `${(this.current_value / 1000000000).toFixed(2)}B GHS`;
  } else if (this.current_value >= 1000000) {
    return `${(this.current_value / 1000000).toFixed(2)}M GHS`;
  }
  return `${this.current_value.toFixed(2)} GHS`;
});

governmentGDPValueSchema.virtual('percentage_change').get(function(this: IGovernmentGDPValue) {
  if (!this.previous_value || this.previous_value === 0) return 0;
  return ((this.current_value - this.previous_value) / Math.abs(this.previous_value)) * 100;
});

governmentGDPValueSchema.methods.addToHistory = function(this: IGovernmentGDPValue) {
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

governmentGDPValueSchema.statics.findLatest = function() {
  return this.findOne().sort({ last_updated: -1 });
};

governmentGDPValueSchema.pre<IGovernmentGDPValue>('save', function () {
  if (this.isModified('current_value') || this.isModified('gdp_history')) {
    this.last_updated = new Date();
  }
});

const interestRateSchema = new Schema<IInterestRate>(
  {
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

interestRateSchema.index({ effective_date: -1 });
interestRateSchema.index({ 'historical_data.date': -1 });

interestRateSchema.virtual('formatted_value').get(function(this: IInterestRate) {
  return `${this.current_value.toFixed(2)}%`;
});

interestRateSchema.virtual('percentage_change').get(function(this: IInterestRate) {
  if (!this.previous_value || this.previous_value === 0) return 0;
  return ((this.current_value - this.previous_value) / Math.abs(this.previous_value)) * 100;
});

interestRateSchema.virtual('is_within_target').get(function(this: IInterestRate) {
  return this.current_value >= this.target_range_min && this.current_value <= this.target_range_max;
});

interestRateSchema.methods.addToHistory = function(this: IInterestRate) {
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

interestRateSchema.statics.findLatest = function() {
  return this.findOne().sort({ effective_date: -1 });
};

const inflationRateSchema = new Schema<IInflationRate>(
  {
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

inflationRateSchema.index({ year: 1, month: 1 }, { unique: true });
inflationRateSchema.index({ 'historical_data.year': -1, 'historical_data.month': -1 });

inflationRateSchema.virtual('formatted_value').get(function(this: IInflationRate) {
  return `${this.current_value.toFixed(2)}%`;
});

inflationRateSchema.virtual('percentage_change').get(function(this: IInflationRate) {
  if (!this.previous_value || this.previous_value === 0) return 0;
  return ((this.current_value - this.previous_value) / Math.abs(this.previous_value)) * 100;
});

inflationRateSchema.virtual('is_within_target').get(function(this: IInflationRate) {
  return this.current_value >= this.target_range_min && this.current_value <= this.target_range_max;
});

inflationRateSchema.methods.addToHistory = function(this: IInflationRate) {
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

inflationRateSchema.statics.findLatest = function() {
  return this.findOne().sort({ year: -1, month: -1 });
};

inflationRateSchema.statics.findByMonthAndYear = function(month: string, year: number) {
  return this.findOne({ month, year });
};

const unemploymentRateSchema = new Schema<IUnemploymentRate>(
  {
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

unemploymentRateSchema.index({ year: 1, quarter: 1 }, { unique: true });
unemploymentRateSchema.index({ 'historical_data.year': -1, 'historical_data.quarter': -1 });

unemploymentRateSchema.virtual('formatted_value').get(function(this: IUnemploymentRate) {
  return `${this.current_value.toFixed(1)}%`;
});

unemploymentRateSchema.virtual('percentage_change').get(function(this: IUnemploymentRate) {
  if (!this.previous_value || this.previous_value === 0) return 0;
  return ((this.current_value - this.previous_value) / Math.abs(this.previous_value)) * 100;
});

unemploymentRateSchema.virtual('is_below_target').get(function(this: IUnemploymentRate) {
  return this.current_value <= this.target;
});

unemploymentRateSchema.methods.addToHistory = function(this: IUnemploymentRate) {
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

unemploymentRateSchema.statics.findLatest = function() {
  return this.findOne().sort({ year: -1, quarter: -1 });
};

unemploymentRateSchema.statics.findByQuarterAndYear = function(quarter: string, year: number) {
  return this.findOne({ quarter, year });
};

const balanceOfTradeSchema = new Schema<IBalanceOfTrade>(
  {
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

balanceOfTradeSchema.index({ year: 1, month: 1 }, { unique: true });

balanceOfTradeSchema.virtual('formatted_balance').get(function(this: IBalanceOfTrade) {
  const absBalance = Math.abs(this.current_balance);
  if (absBalance >= 1000000000) {
    return `${(this.current_balance / 1000000000).toFixed(2)}B ${this.currency}`;
  } else if (absBalance >= 1000000) {
    return `${(this.current_balance / 1000000).toFixed(2)}M ${this.currency}`;
  }
  return `${this.current_balance.toFixed(2)} ${this.currency}`;
});

balanceOfTradeSchema.virtual('is_surplus').get(function(this: IBalanceOfTrade) {
  return this.current_balance > 0;
});

balanceOfTradeSchema.virtual('balance_change').get(function(this: IBalanceOfTrade) {
  if (!this.previous_balance) return 0;
  return this.current_balance - this.previous_balance;
});

balanceOfTradeSchema.methods.addToHistory = function(this: IBalanceOfTrade) {
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

balanceOfTradeSchema.statics.findLatest = function() {
  return this.findOne().sort({ year: -1, month: -1 });
};

balanceOfTradeSchema.statics.findByMonthAndYear = function(month: string, year: number) {
  return this.findOne({ month, year });
};

const governmentDebtToGDPSchema = new Schema<IGovernmentDebtToGDP>(
  {
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

governmentDebtToGDPSchema.index({ year: 1 }, { unique: true });

governmentDebtToGDPSchema.virtual('formatted_value').get(function(this: IGovernmentDebtToGDP) {
  return `${this.current_value.toFixed(1)}%`;
});

governmentDebtToGDPSchema.virtual('percentage_change').get(function(this: IGovernmentDebtToGDP) {
  if (!this.previous_value || this.previous_value === 0) return 0;
  return ((this.current_value - this.previous_value) / Math.abs(this.previous_value)) * 100;
});

governmentDebtToGDPSchema.virtual('is_below_target').get(function(this: IGovernmentDebtToGDP) {
  return this.current_value <= this.target_max;
});

governmentDebtToGDPSchema.methods.addToHistory = function(this: IGovernmentDebtToGDP) {
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

governmentDebtToGDPSchema.statics.findLatest = function() {
  return this.findOne().sort({ year: -1 });
};

governmentDebtToGDPSchema.statics.findByYear = function(year: number) {
  return this.findOne({ year });
};

const governmentDebtValueSchema = new Schema<IGovernmentDebtValue>(
  {
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

governmentDebtValueSchema.index({ current_year: 1, current_month: 1 }, { unique: false });

governmentDebtValueSchema.virtual('formatted_value').get(function(this: IGovernmentDebtValue) {
  if (this.current_value >= 1000000000) {
    return `${(this.current_value / 1000000000).toFixed(2)}B GHS`;
  } else if (this.current_value >= 1000000) {
    return `${(this.current_value / 1000000).toFixed(2)}M GHS`;
  }
  return `${this.current_value.toFixed(2)} GHS`;
});

governmentDebtValueSchema.methods.addToHistory = function(this: IGovernmentDebtValue) {
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

governmentDebtValueSchema.pre<IGovernmentDebtValue>('save', function () {
  if (this.isModified('current_value') || this.isModified('debt_history')) {
    this.last_updated = new Date();
  }
});

const governmentBudgetValueSchema = new Schema<IGovernmentBudgetValue>(
  {
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

governmentBudgetValueSchema.index({ year: 1, month: 1 }, { unique: true });

governmentBudgetValueSchema.virtual('formatted_value').get(function(this: IGovernmentBudgetValue) {
  const absValue = Math.abs(this.current_value);
  if (absValue >= 1000000000) {
    return `${(this.current_value / 1000000000).toFixed(2)}B ${this.currency}`;
  } else if (absValue >= 1000000) {
    return `${(this.current_value / 1000000).toFixed(2)}M ${this.currency}`;
  }
  return `${this.current_value.toFixed(2)} ${this.currency}`;
});

governmentBudgetValueSchema.virtual('is_surplus').get(function(this: IGovernmentBudgetValue) {
  return this.current_value > 0;
});

governmentBudgetValueSchema.virtual('balance_change').get(function(this: IGovernmentBudgetValue) {
  if (!this.previous_value) return 0;
  return this.current_value - this.previous_value;
});

governmentBudgetValueSchema.methods.addToHistory = function(this: IGovernmentBudgetValue) {
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

governmentBudgetValueSchema.statics.findLatest = function() {
  return this.findOne().sort({ year: -1, month: -1 });
};

const governmentRevenuesSchema = new Schema<IGovernmentRevenues>(
  {
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

governmentRevenuesSchema.index({ year: 1, month: 1 }, { unique: true });

governmentRevenuesSchema.virtual('formatted_value').get(function(this: IGovernmentRevenues) {
  if (this.current_value >= 1000000000) {
    return `${(this.current_value / 1000000000).toFixed(2)}B ${this.currency}`;
  } else if (this.current_value >= 1000000) {
    return `${(this.current_value / 1000000).toFixed(2)}M ${this.currency}`;
  }
  return `${this.current_value.toFixed(2)} ${this.currency}`;
});

governmentRevenuesSchema.virtual('percentage_change').get(function(this: IGovernmentRevenues) {
  if (!this.previous_value || this.previous_value === 0) return 0;
  return ((this.current_value - this.previous_value) / Math.abs(this.previous_value)) * 100;
});

governmentRevenuesSchema.methods.addToHistory = function(this: IGovernmentRevenues) {
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

governmentRevenuesSchema.statics.findLatest = function() {
  return this.findOne().sort({ year: -1, month: -1 });
};

const fiscalExpenditureSchema = new Schema<IFiscalExpenditure>(
  {
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

fiscalExpenditureSchema.index({ year: 1, month: 1 }, { unique: true });

fiscalExpenditureSchema.virtual('formatted_value').get(function(this: IFiscalExpenditure) {
  if (this.current_value >= 1000000000) {
    return `${(this.current_value / 1000000000).toFixed(2)}B ${this.currency}`;
  } else if (this.current_value >= 1000000) {
    return `${(this.current_value / 1000000).toFixed(2)}M ${this.currency}`;
  }
  return `${this.current_value.toFixed(2)} ${this.currency}`;
});

fiscalExpenditureSchema.virtual('percentage_change').get(function(this: IFiscalExpenditure) {
  if (!this.previous_value || this.previous_value === 0) return 0;
  return ((this.current_value - this.previous_value) / Math.abs(this.previous_value)) * 100;
});

fiscalExpenditureSchema.methods.addToHistory = function(this: IFiscalExpenditure) {
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

fiscalExpenditureSchema.statics.findLatest = function() {
  return this.findOne().sort({ year: -1, month: -1 });
};

const governmentSpendingSchema = new Schema<IGovernmentSpending>(
  {
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

governmentSpendingSchema.index({ year: 1 }, { unique: true });

governmentSpendingSchema.virtual('formatted_value').get(function(this: IGovernmentSpending) {
  if (this.current_value >= 1000000000) {
    return `${(this.current_value / 1000000000).toFixed(2)}B ${this.currency}`;
  } else if (this.current_value >= 1000000) {
    return `${(this.current_value / 1000000).toFixed(2)}M ${this.currency}`;
  }
  return `${this.current_value.toFixed(2)} ${this.currency}`;
});

governmentSpendingSchema.virtual('percentage_change').get(function(this: IGovernmentSpending) {
  if (!this.previous_value || this.previous_value === 0) return 0;
  return ((this.current_value - this.previous_value) / Math.abs(this.previous_value)) * 100;
});

governmentSpendingSchema.methods.addToHistory = function(this: IGovernmentSpending) {
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

governmentSpendingSchema.statics.findLatest = function() {
  return this.findOne().sort({ year: -1 });
};

const GDPGrowthQuarterly = mongoose.model<IGDPGrowthQuarterly, IGDPGrowthQuarterlyModel>('GDPGrowthQuarterly', gdpGrowthQuarterlySchema);
const GDPGrowthAnnual = mongoose.model<IGDPGrowthAnnual, IGDPGrowthAnnualModel>('GDPGrowthAnnual', gdpGrowthAnnualSchema);
const GovernmentGDPValue = mongoose.model<IGovernmentGDPValue, IGovernmentGDPValueModel>('GovernmentGDPValue', governmentGDPValueSchema);
const InterestRate = mongoose.model<IInterestRate, IInterestRateModel>('InterestRate', interestRateSchema);
const InflationRate = mongoose.model<IInflationRate, IInflationRateModel>('InflationRate', inflationRateSchema);
const UnemploymentRate = mongoose.model<IUnemploymentRate, IUnemploymentRateModel>('UnemploymentRate', unemploymentRateSchema);
const BalanceOfTrade = mongoose.model<IBalanceOfTrade, IBalanceOfTradeModel>('BalanceOfTrade', balanceOfTradeSchema);
const GovernmentDebtToGDP = mongoose.model<IGovernmentDebtToGDP, IGovernmentDebtToGDPModel>('GovernmentDebtToGDP', governmentDebtToGDPSchema);
const GovernmentDebtValue = mongoose.model<IGovernmentDebtValue, IGovernmentDebtValueModel>('GovernmentDebtValue', governmentDebtValueSchema);
const GovernmentBudgetValue = mongoose.model<IGovernmentBudgetValue, IGovernmentBudgetValueModel>('GovernmentBudgetValue', governmentBudgetValueSchema);
const GovernmentRevenues = mongoose.model<IGovernmentRevenues, IGovernmentRevenuesModel>('GovernmentRevenues', governmentRevenuesSchema);
const FiscalExpenditure = mongoose.model<IFiscalExpenditure, IFiscalExpenditureModel>('FiscalExpenditure', fiscalExpenditureSchema);
const GovernmentSpending = mongoose.model<IGovernmentSpending, IGovernmentSpendingModel>('GovernmentSpending', governmentSpendingSchema);

export {
  GDPGrowthQuarterly,
  GDPGrowthAnnual,
  GovernmentGDPValue,
  InterestRate,
  InflationRate,
  UnemploymentRate,
  BalanceOfTrade,
  GovernmentDebtToGDP,
  GovernmentDebtValue,
  GovernmentBudgetValue,
  GovernmentRevenues,
  FiscalExpenditure,
  GovernmentSpending,
};