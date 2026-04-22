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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const economic_controller_1 = require("../controllers/economic.controller");
const rateLimit_1 = require("../middleware/rateLimit");
const router = express_1.default.Router();
router.post('/gdp-growth-quarterly', economic_controller_1.createGDPGrowthQuarterly);
router.put('/gdp-growth-quarterly/:id', economic_controller_1.updateGDPGrowthQuarterly);
router.delete('/gdp-growth-quarterly/:id', economic_controller_1.deleteGDPGrowthQuarterly);
router.get('/gdp-growth-quarterly', rateLimit_1.apiKeyRateLimit, economic_controller_1.getAllGDPGrowthQuarterly);
router.get('/gdp-growth-quarterly/latest', rateLimit_1.apiKeyRateLimit, economic_controller_1.getLatestGDPGrowthQuarterly);
router.get('/gdp-growth-quarterly/history', rateLimit_1.apiKeyRateLimit, economic_controller_1.getGDPGrowthQuarterlyHistory);
router.post('/gdp-growth-annual', economic_controller_1.createGDPGrowthAnnual);
router.put('/gdp-growth-annual/:id', economic_controller_1.updateGDPGrowthAnnual);
router.delete('/gdp-growth-annual/:id', economic_controller_1.deleteGDPGrowthAnnual);
router.get('/gdp-growth-annual', rateLimit_1.apiKeyRateLimit, economic_controller_1.getAllGDPGrowthAnnual);
router.get('/gdp-growth-annual/latest', rateLimit_1.apiKeyRateLimit, economic_controller_1.getLatestGDPGrowthAnnual);
router.get('/gdp-growth-annual/history', rateLimit_1.apiKeyRateLimit, economic_controller_1.getGDPGrowthAnnualHistory);
router.post('/government-gdp-value', economic_controller_1.createGovernmentGDPValue);
router.put('/government-gdp-value/:id', economic_controller_1.updateGovernmentGDPValue);
router.delete('/government-gdp-value/:id', economic_controller_1.deleteGovernmentGDPValue);
router.get('/government-gdp-value', rateLimit_1.apiKeyRateLimit, economic_controller_1.getAllGovernmentGDPValue);
router.get('/government-gdp-value/latest', rateLimit_1.apiKeyRateLimit, economic_controller_1.getLatestGovernmentGDPValue);
router.get('/government-gdp-value/history', rateLimit_1.apiKeyRateLimit, economic_controller_1.getGovernmentGDPValueHistory);
router.post('/interest-rate', economic_controller_1.createInterestRate);
router.put('/interest-rate/:id', economic_controller_1.updateInterestRate);
router.delete('/interest-rate/:id', economic_controller_1.deleteInterestRate);
router.get('/interest-rate', rateLimit_1.apiKeyRateLimit, economic_controller_1.getAllInterestRate);
router.get('/interest-rate/latest', rateLimit_1.apiKeyRateLimit, economic_controller_1.getLatestInterestRate);
router.get('/interest-rate/history', rateLimit_1.apiKeyRateLimit, economic_controller_1.getInterestRateHistory);
router.post('/inflation-rate', economic_controller_1.createInflationRate);
router.put('/inflation-rate/:id', economic_controller_1.updateInflationRate);
router.delete('/inflation-rate/:id', economic_controller_1.deleteInflationRate);
router.get('/inflation-rate', rateLimit_1.apiKeyRateLimit, economic_controller_1.getAllInflationRate);
router.get('/inflation-rate/latest', rateLimit_1.apiKeyRateLimit, economic_controller_1.getLatestInflationRate);
router.get('/inflation-rate/history', rateLimit_1.apiKeyRateLimit, economic_controller_1.getInflationRateHistory);
router.post('/unemployment-rate', economic_controller_1.createUnemploymentRate);
router.put('/unemployment-rate/:id', economic_controller_1.updateUnemploymentRate);
router.delete('/unemployment-rate/:id', economic_controller_1.deleteUnemploymentRate);
router.get('/unemployment-rate', rateLimit_1.apiKeyRateLimit, economic_controller_1.getAllUnemploymentRate);
router.get('/unemployment-rate/latest', rateLimit_1.apiKeyRateLimit, economic_controller_1.getLatestUnemploymentRate);
router.get('/unemployment-rate/history', rateLimit_1.apiKeyRateLimit, economic_controller_1.getUnemploymentRateHistory);
router.post('/balance-of-trade', economic_controller_1.createBalanceOfTrade);
router.put('/balance-of-trade/:id', economic_controller_1.updateBalanceOfTrade);
router.delete('/balance-of-trade/:id', economic_controller_1.deleteBalanceOfTrade);
router.get('/balance-of-trade', rateLimit_1.apiKeyRateLimit, economic_controller_1.getAllBalanceOfTrade);
router.get('/balance-of-trade/latest', rateLimit_1.apiKeyRateLimit, economic_controller_1.getLatestBalanceOfTrade);
router.get('/balance-of-trade/history', rateLimit_1.apiKeyRateLimit, economic_controller_1.getBalanceOfTradeHistory);
router.post('/government-debt-to-gdp', economic_controller_1.createGovernmentDebtToGDP);
router.put('/government-debt-to-gdp/:id', economic_controller_1.updateGovernmentDebtToGDP);
router.delete('/government-debt-to-gdp/:id', economic_controller_1.deleteGovernmentDebtToGDP);
router.get('/government-debt-to-gdp', rateLimit_1.apiKeyRateLimit, economic_controller_1.getAllGovernmentDebtToGDP);
router.get('/government-debt-to-gdp/latest', rateLimit_1.apiKeyRateLimit, economic_controller_1.getLatestGovernmentDebtToGDP);
router.get('/government-debt-to-gdp/history', rateLimit_1.apiKeyRateLimit, economic_controller_1.getGovernmentDebtToGDPHistory);
router.post('/government-debt-value', economic_controller_1.createGovernmentDebtValue);
router.put('/government-debt-value/:id', economic_controller_1.updateGovernmentDebtValue);
router.delete('/government-debt-value/:id', economic_controller_1.deleteGovernmentDebtValue);
router.get('/government-debt-value', rateLimit_1.apiKeyRateLimit, economic_controller_1.getAllGovernmentDebtValue);
router.get('/government-debt-value/latest', rateLimit_1.apiKeyRateLimit, economic_controller_1.getLatestGovernmentDebtValue);
router.get('/government-debt-value/history', rateLimit_1.apiKeyRateLimit, economic_controller_1.getGovernmentDebtValueHistory);
router.post('/government-budget-value', economic_controller_1.createGovernmentBudgetValue);
router.put('/government-budget-value/:id', economic_controller_1.updateGovernmentBudgetValue);
router.delete('/government-budget-value/:id', economic_controller_1.deleteGovernmentBudgetValue);
router.get('/government-budget-value', rateLimit_1.apiKeyRateLimit, economic_controller_1.getAllGovernmentBudgetValue);
router.get('/government-budget-value/latest', rateLimit_1.apiKeyRateLimit, economic_controller_1.getLatestGovernmentBudgetValue);
router.get('/government-budget-value/history', rateLimit_1.apiKeyRateLimit, economic_controller_1.getGovernmentBudgetValueHistory);
router.post('/government-revenues', economic_controller_1.createGovernmentRevenues);
router.put('/government-revenues/:id', economic_controller_1.updateGovernmentRevenues);
router.delete('/government-revenues/:id', economic_controller_1.deleteGovernmentRevenues);
router.get('/government-revenues', rateLimit_1.apiKeyRateLimit, economic_controller_1.getAllGovernmentRevenues);
router.get('/government-revenues/latest', rateLimit_1.apiKeyRateLimit, economic_controller_1.getLatestGovernmentRevenues);
router.get('/government-revenues/history', rateLimit_1.apiKeyRateLimit, economic_controller_1.getGovernmentRevenuesHistory);
router.post('/fiscal-expenditure', economic_controller_1.createFiscalExpenditure);
router.put('/fiscal-expenditure/:id', economic_controller_1.updateFiscalExpenditure);
router.delete('/fiscal-expenditure/:id', economic_controller_1.deleteFiscalExpenditure);
router.get('/fiscal-expenditure', rateLimit_1.apiKeyRateLimit, economic_controller_1.getAllFiscalExpenditure);
router.get('/fiscal-expenditure/latest', rateLimit_1.apiKeyRateLimit, economic_controller_1.getLatestFiscalExpenditure);
router.get('/fiscal-expenditure/history', rateLimit_1.apiKeyRateLimit, economic_controller_1.getFiscalExpenditureHistory);
router.post('/government-spending', economic_controller_1.createGovernmentSpending);
router.put('/government-spending/:id', economic_controller_1.updateGovernmentSpending);
router.delete('/government-spending/:id', economic_controller_1.deleteGovernmentSpending);
router.get('/government-spending', rateLimit_1.apiKeyRateLimit, economic_controller_1.getAllGovernmentSpending);
router.get('/government-spending/latest', rateLimit_1.apiKeyRateLimit, economic_controller_1.getLatestGovernmentSpending);
router.get('/government-spending/history', rateLimit_1.apiKeyRateLimit, economic_controller_1.getGovernmentSpendingHistory);
router.post('/indicators/bulk', economic_controller_1.bulkUpdateIndicators);
router.get('/indicators/latest-all', async (req, res) => {
    try {
        const cacheKey = 'economic:indicators:latest-all';
        const cached = await (0, economic_controller_1.getCache)(cacheKey);
        if (cached) {
            return res.status(200).json({
                success: true,
                code: 200,
                fromCache: true,
                data: cached,
            });
        }
        const { GDPGrowthQuarterly, GDPGrowthAnnual, GovernmentGDPValue, InterestRate, InflationRate, UnemploymentRate, BalanceOfTrade, GovernmentDebtToGDP, GovernmentDebtValue, GovernmentBudgetValue, GovernmentRevenues, FiscalExpenditure, GovernmentSpending, } = await Promise.resolve().then(() => __importStar(require('../models/economic.model')));
        if (!GDPGrowthQuarterly) {
            throw new Error('GDPGrowthQuarterly model not available');
        }
        const [gdpGrowthQuarterly, gdpGrowthAnnual, governmentGDPValue, interestRate, inflationRate, unemploymentRate, balanceOfTrade, governmentDebtToGDP, governmentDebtValue, governmentBudgetValue, governmentRevenues, fiscalExpenditure, governmentSpending,] = await Promise.all([
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
        await (0, economic_controller_1.setCache)(cacheKey, result, 300);
        return res.status(200).json({
            success: true,
            code: 200,
            fromCache: false,
            data: result,
        });
    }
    catch (error) {
        console.error('Get all latest indicators error:', error);
        return res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal server error fetching latest indicators',
            errorId: `ECON-ERR-${Date.now()}`,
        });
    }
});
exports.default = router;
//# sourceMappingURL=economic.routes.js.map