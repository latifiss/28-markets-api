import express, { Request, Response } from 'express';
import {
  createGDPGrowthQuarterly,
  getAllGDPGrowthQuarterly,
  getLatestGDPGrowthQuarterly,
  updateGDPGrowthQuarterly,
  deleteGDPGrowthQuarterly,
  getGDPGrowthQuarterlyHistory,
  createGDPGrowthAnnual,
  getAllGDPGrowthAnnual,
  getLatestGDPGrowthAnnual,
  updateGDPGrowthAnnual,
  deleteGDPGrowthAnnual,
  getGDPGrowthAnnualHistory,
  createGovernmentGDPValue,
  getAllGovernmentGDPValue,
  getLatestGovernmentGDPValue,
  updateGovernmentGDPValue,
  deleteGovernmentGDPValue,
  getGovernmentGDPValueHistory,
  createInterestRate,
  getAllInterestRate,
  getLatestInterestRate,
  updateInterestRate,
  deleteInterestRate,
  getInterestRateHistory,
  createInflationRate,
  getAllInflationRate,
  getLatestInflationRate,
  updateInflationRate,
  deleteInflationRate,
  getInflationRateHistory,
  createUnemploymentRate,
  getAllUnemploymentRate,
  getLatestUnemploymentRate,
  updateUnemploymentRate,
  deleteUnemploymentRate,
  getUnemploymentRateHistory,
  createBalanceOfTrade,
  getAllBalanceOfTrade,
  getLatestBalanceOfTrade,
  updateBalanceOfTrade,
  deleteBalanceOfTrade,
  getBalanceOfTradeHistory,
  createGovernmentDebtToGDP,
  getAllGovernmentDebtToGDP,
  getLatestGovernmentDebtToGDP,
  updateGovernmentDebtToGDP,
  deleteGovernmentDebtToGDP,
  getGovernmentDebtToGDPHistory,
  createGovernmentDebtValue,
  getAllGovernmentDebtValue,
  getLatestGovernmentDebtValue,
  updateGovernmentDebtValue,
  deleteGovernmentDebtValue,
  getGovernmentDebtValueHistory,
  createGovernmentBudgetValue,
  getAllGovernmentBudgetValue,
  getLatestGovernmentBudgetValue,
  updateGovernmentBudgetValue,
  deleteGovernmentBudgetValue,
  getGovernmentBudgetValueHistory,
  createGovernmentRevenues,
  getAllGovernmentRevenues,
  getLatestGovernmentRevenues,
  updateGovernmentRevenues,
  deleteGovernmentRevenues,
  getGovernmentRevenuesHistory,
  createFiscalExpenditure,
  getAllFiscalExpenditure,
  getLatestFiscalExpenditure,
  updateFiscalExpenditure,
  deleteFiscalExpenditure,
  getFiscalExpenditureHistory,
  createGovernmentSpending,
  getAllGovernmentSpending,
  getLatestGovernmentSpending,
  updateGovernmentSpending,
  deleteGovernmentSpending,
  getGovernmentSpendingHistory,
  bulkUpdateIndicators,
} from '../controllers/economic.controller';
import { setCache, getCache } from '../lib/cache';

const router = express.Router();

router.post('/gdp-growth-quarterly', createGDPGrowthQuarterly);
router.put('/gdp-growth-quarterly/:id', updateGDPGrowthQuarterly);
router.delete('/gdp-growth-quarterly/:id', deleteGDPGrowthQuarterly);
router.get('/gdp-growth-quarterly', getAllGDPGrowthQuarterly);
router.get(
  '/gdp-growth-quarterly/latest',
  getLatestGDPGrowthQuarterly,
);
router.get(
  '/gdp-growth-quarterly/history',
  getGDPGrowthQuarterlyHistory,
);

router.post('/gdp-growth-annual', createGDPGrowthAnnual);
router.put('/gdp-growth-annual/:id', updateGDPGrowthAnnual);
router.delete('/gdp-growth-annual/:id', deleteGDPGrowthAnnual);
router.get('/gdp-growth-annual', getAllGDPGrowthAnnual);
router.get(
  '/gdp-growth-annual/latest',
  getLatestGDPGrowthAnnual,
);
router.get(
  '/gdp-growth-annual/history',
  getGDPGrowthAnnualHistory,
);

router.post('/government-gdp-value', createGovernmentGDPValue);
router.put('/government-gdp-value/:id', updateGovernmentGDPValue);
router.delete('/government-gdp-value/:id', deleteGovernmentGDPValue);
router.get('/government-gdp-value', getAllGovernmentGDPValue);
router.get(
  '/government-gdp-value/latest',
  getLatestGovernmentGDPValue,
);
router.get(
  '/government-gdp-value/history',
  getGovernmentGDPValueHistory,
);

router.post('/interest-rate', createInterestRate);
router.put('/interest-rate/:id', updateInterestRate);
router.delete('/interest-rate/:id', deleteInterestRate);
router.get('/interest-rate', getAllInterestRate);
router.get('/interest-rate/latest', getLatestInterestRate);
router.get('/interest-rate/history', getInterestRateHistory);

router.post('/inflation-rate', createInflationRate);
router.put('/inflation-rate/:id', updateInflationRate);
router.delete('/inflation-rate/:id', deleteInflationRate);
router.get('/inflation-rate', getAllInflationRate);
router.get('/inflation-rate/latest', getLatestInflationRate);
router.get('/inflation-rate/history', getInflationRateHistory);

router.post('/unemployment-rate', createUnemploymentRate);
router.put('/unemployment-rate/:id', updateUnemploymentRate);
router.delete('/unemployment-rate/:id', deleteUnemploymentRate);
router.get('/unemployment-rate', getAllUnemploymentRate);
router.get(
  '/unemployment-rate/latest',
  getLatestUnemploymentRate,
);
router.get(
  '/unemployment-rate/history',
  getUnemploymentRateHistory,
);

router.post('/balance-of-trade', createBalanceOfTrade);
router.put('/balance-of-trade/:id', updateBalanceOfTrade);
router.delete('/balance-of-trade/:id', deleteBalanceOfTrade);
router.get('/balance-of-trade', getAllBalanceOfTrade);
router.get(
  '/balance-of-trade/latest',
  getLatestBalanceOfTrade,
);
router.get(
  '/balance-of-trade/history',
  getBalanceOfTradeHistory,
);

router.post('/government-debt-to-gdp', createGovernmentDebtToGDP);
router.put('/government-debt-to-gdp/:id', updateGovernmentDebtToGDP);
router.delete('/government-debt-to-gdp/:id', deleteGovernmentDebtToGDP);
router.get(
  '/government-debt-to-gdp',
  getAllGovernmentDebtToGDP,
);
router.get(
  '/government-debt-to-gdp/latest',
  getLatestGovernmentDebtToGDP,
);
router.get(
  '/government-debt-to-gdp/history',
  getGovernmentDebtToGDPHistory,
);

router.post('/government-debt-value', createGovernmentDebtValue);
router.put('/government-debt-value/:id', updateGovernmentDebtValue);
router.delete('/government-debt-value/:id', deleteGovernmentDebtValue);
router.get(
  '/government-debt-value',
  getAllGovernmentDebtValue,
);
router.get(
  '/government-debt-value/latest',
  getLatestGovernmentDebtValue,
);
router.get(
  '/government-debt-value/history',
  getGovernmentDebtValueHistory,
);

router.post('/government-budget-value', createGovernmentBudgetValue);
router.put('/government-budget-value/:id', updateGovernmentBudgetValue);
router.delete('/government-budget-value/:id', deleteGovernmentBudgetValue);
router.get(
  '/government-budget-value',
  getAllGovernmentBudgetValue,
);
router.get(
  '/government-budget-value/latest',
  getLatestGovernmentBudgetValue,
);
router.get(
  '/government-budget-value/history',
  getGovernmentBudgetValueHistory,
);

router.post('/government-revenues', createGovernmentRevenues);
router.put('/government-revenues/:id', updateGovernmentRevenues);
router.delete('/government-revenues/:id', deleteGovernmentRevenues);
router.get('/government-revenues', getAllGovernmentRevenues);
router.get(
  '/government-revenues/latest',
  getLatestGovernmentRevenues,
);
router.get(
  '/government-revenues/history',
  getGovernmentRevenuesHistory,
);

router.post('/fiscal-expenditure', createFiscalExpenditure);
router.put('/fiscal-expenditure/:id', updateFiscalExpenditure);
router.delete('/fiscal-expenditure/:id', deleteFiscalExpenditure);
router.get('/fiscal-expenditure', getAllFiscalExpenditure);
router.get(
  '/fiscal-expenditure/latest',
  getLatestFiscalExpenditure,
);
router.get(
  '/fiscal-expenditure/history',
  getFiscalExpenditureHistory,
);

router.post('/government-spending', createGovernmentSpending);
router.put('/government-spending/:id', updateGovernmentSpending);
router.delete('/government-spending/:id', deleteGovernmentSpending);
router.get('/government-spending', getAllGovernmentSpending);
router.get(
  '/government-spending/latest',
  getLatestGovernmentSpending,
);
router.get(
  '/government-spending/history',
  getGovernmentSpendingHistory,
);

router.post('/indicators/bulk', bulkUpdateIndicators);

router.get('/indicators/latest-all', async (req: Request, res: Response) => {
  try {
    const cacheKey = 'economic:indicators:latest-all';
    const cached = await getCache(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        code: 200,
        fromCache: true,
        data: cached,
      });
    }

    const {
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
    } = await import('../models/economic.model');

    if (!GDPGrowthQuarterly) {
      throw new Error('GDPGrowthQuarterly model not available');
    }

    const [
      gdpGrowthQuarterly,
      gdpGrowthAnnual,
      governmentGDPValue,
      interestRate,
      inflationRate,
      unemploymentRate,
      balanceOfTrade,
      governmentDebtToGDP,
      governmentDebtValue,
      governmentBudgetValue,
      governmentRevenues,
      fiscalExpenditure,
      governmentSpending,
    ] = await Promise.all([
      GDPGrowthQuarterly.findLatest(),
      GDPGrowthAnnual.findLatest(),
      GovernmentGDPValue.findLatest(),
      InterestRate.findLatest(),
      InflationRate.findLatest(),
      UnemploymentRate.findLatest(),
      BalanceOfTrade.findLatest(),
      GovernmentDebtToGDP.findLatest(),
      GovernmentDebtValue.findLatest(),
      GovernmentBudgetValue.findLatest(),
      GovernmentRevenues.findLatest(),
      FiscalExpenditure.findLatest(),
      GovernmentSpending.findLatest(),
    ]);

    const result = {
      gdp_growth_quarterly: gdpGrowthQuarterly,
      gdp_growth_annual: gdpGrowthAnnual,
      government_gdp_value: governmentGDPValue,
      interest_rate: interestRate,
      inflation_rate: inflationRate,
      unemployment_rate: unemploymentRate,
      balance_of_trade: balanceOfTrade,
      government_debt_to_gdp: governmentDebtToGDP,
      government_debt_value: governmentDebtValue,
      government_budget_value: governmentBudgetValue,
      government_revenues: governmentRevenues,
      fiscal_expenditure: fiscalExpenditure,
      government_spending: governmentSpending,
    };

    await setCache(cacheKey, result, 300);

    return res.status(200).json({
      success: true,
      code: 200,
      fromCache: false,
      data: result,
    });
  } catch (error: any) {
    console.error('Get all latest indicators error:', error);
    return res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error fetching latest indicators',
      errorId: `ECON-ERR-${Date.now()}`,
    });
  }
});

export default router;
