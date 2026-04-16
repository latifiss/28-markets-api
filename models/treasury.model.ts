import mongoose, { Schema, Document } from 'mongoose';

interface ITreasuryBond extends Document {
  name: string;
  tender: string;
  discount_rate: number;
  interest_rate: number;
  maturity: '91-Day' | '182-Day' | '364-Day' | '2-Year' | '3-Year' | '5-Year' | 'Other';
  maturity_days: number;
  type: 'T-Bill' | 'Fixed Rate Note' | 'Fixed Rate Bond' | 'GOG Bond';
  issue_date: Date;
  maturity_date?: Date;
  face_value: number;
  minimum_investment: number;
  yield?: number;
  is_active: boolean;
  risk_level: 'Low' | 'Medium' | 'High';
  description?: string;
  last_updated: Date;
  createdAt: Date;
  updatedAt: Date;
  discount_rate_formatted: string;
  interest_rate_formatted: string;
  days_to_maturity: number;
  calculatePrice(investmentAmount?: number): number;
  calculateInterest(investmentAmount?: number): number;
  calculateTotalReturn(investmentAmount?: number): number;
}

interface ITreasuryBondModel extends mongoose.Model<ITreasuryBond> {
  findByMaturity(maturity: string): Promise<ITreasuryBond[]>;
  findActiveBonds(): Promise<ITreasuryBond[]>;
  findHighestYielding(limit?: number): Promise<ITreasuryBond[]>;
}

const treasuryBondSchema = new Schema<ITreasuryBond>(
  {
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

treasuryBondSchema.index({ name: 1 });
treasuryBondSchema.index({ maturity: 1 });
treasuryBondSchema.index({ type: 1 });
treasuryBondSchema.index({ discount_rate: -1 });
treasuryBondSchema.index({ interest_rate: -1 });
treasuryBondSchema.index({ is_active: 1 });

treasuryBondSchema.virtual('discount_rate_formatted').get(function(this: ITreasuryBond) {
  return `${this.discount_rate.toFixed(2)}%`;
});

treasuryBondSchema.virtual('interest_rate_formatted').get(function(this: ITreasuryBond) {
  return `${this.interest_rate.toFixed(2)}%`;
});

treasuryBondSchema.virtual('days_to_maturity').get(function(this: ITreasuryBond) {
  if (!this.maturity_date) return this.maturity_days;

  const today = new Date();
  const maturity = new Date(this.maturity_date);
  const diffTime = Math.abs(maturity.getTime() - today.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
});

treasuryBondSchema.methods.calculatePrice = function(this: ITreasuryBond, investmentAmount = this.face_value) {
  const discountAmount = investmentAmount * (this.discount_rate / 100);
  const price = investmentAmount - discountAmount;
  return parseFloat(price.toFixed(2));
};

treasuryBondSchema.methods.calculateInterest = function(this: ITreasuryBond, investmentAmount = this.face_value) {
  const interest = investmentAmount * (this.interest_rate / 100);
  return parseFloat(interest.toFixed(2));
};

treasuryBondSchema.methods.calculateTotalReturn = function(this: ITreasuryBond, investmentAmount = this.face_value) {
  const price = this.calculatePrice(investmentAmount);
  const interest = this.calculateInterest(investmentAmount);
  const total = price + interest;
  return parseFloat(total.toFixed(2));
};

treasuryBondSchema.statics.findByMaturity = function(maturity: string) {
  return this.find({ maturity: new RegExp(maturity, 'i') });
};

treasuryBondSchema.statics.findActiveBonds = function() {
  return this.find({ is_active: true }).sort({ maturity_days: 1 });
};

treasuryBondSchema.statics.findHighestYielding = function(limit = 10) {
  return this.find({ is_active: true })
    .sort({ interest_rate: -1 })
    .limit(limit);
};

treasuryBondSchema.pre<ITreasuryBond>('save', function (this: ITreasuryBond) {
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

const TreasuryBond = mongoose.model<ITreasuryBond, ITreasuryBondModel>('TreasuryBond', treasuryBondSchema);

export default TreasuryBond;