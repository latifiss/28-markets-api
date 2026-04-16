import mongoose, { Schema } from 'mongoose';

const priceHistorySchema = new Schema(
  {
    date: { type: Date, required: true },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const indexSchema = new Schema({
  code: { type: String, required: true, unique: true },
  symbol: { type: String, required: true },
  name: { type: String, required: true },
  currentPrice: { type: Number, required: true },
  value_change: { type: Number, required: true },
  percentage_change: { type: Number, required: true },
  monthly_change: { type: Number },
  yearly_change: { type: Number },
  price_history: [priceHistorySchema],
  last_updated: { type: Date, default: Date.now },
});

const Index = mongoose.model('Index', indexSchema);

export default Index;
