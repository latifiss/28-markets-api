import express from 'express';
import {
  createProfile,
  getProfileByCompanyId,
  updateProfile,
  deleteProfile,
  createStatistics,
  getStatisticsByCompanyId,
  updateStatistics,
  deleteStatistics,
  createDividends,
  getDividendsByCompanyId,
  updateDividends,
  deleteDividends,
  createEarnings,
  getEarningsByCompanyId,
  updateEarnings,
  deleteEarnings,
  createFinancial,
  getFinancialByCompanyId,
  updateFinancial,
  deleteFinancial,
  createHolders,
  getHoldersByCompanyId,
  updateHolders,
  deleteHolders,
  getCompanyAllData,
  createPriceHistory,
  updatePriceHistory,
  getCompanyPriceHistory,
  getCompanyPriceHistoryByLast24Hours,
  getCompanyPriceHistoryByLast1Week,
  getCompanyPriceHistoryByLast3Months,
  getCompanyPriceHistoryByLast6Months,
  getCompanyPriceHistoryByYearToDate,
  getCompanyPriceHistoryByLast1Year,
  getCompanyPriceHistoryByLast2Years,
  getCompanyPriceHistoryByLast5Years,
  getCompanyPriceHistoryByLast10Years,
  getCompanyAllTimePriceHistory,
  deletePriceHistory,
  addPriceEntry,
  updateLatestPrice,
  getGSEMarketStatus,
  manualGSEStatusUpdate,
  getTopGainersByExchange,
  getTopLosersByExchange,
  getPerformanceByIndustry,
  getMarketMoversByExchange,
  bulkCreateProfiles,
  bulkUpdateProfiles,
  bulkCreateStatistics,
  bulkUpdateStatistics,
  bulkCreatePriceHistory,
  bulkAddPriceEntries,
  bulkUpsertCollection,
  bulkDeleteCompanies,
  bulkImportCompanies,
} from '../controllers/stocks.controller';
import { unifiedAuth } from '../middleware/unifiedAuth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Public routes
router.post('/equity/profiles', createProfile);
router.get('/equity/profiles/:company_id', getProfileByCompanyId);
router.put('/equity/profiles/:company_id', updateProfile);
router.delete('/equity/profiles/:company_id', deleteProfile);

router.post('/equity/statistics', createStatistics);
router.get('/equity/statistics/:company_id', getStatisticsByCompanyId);
router.put('/equity/statistics/:company_id', updateStatistics);
router.delete('/equity/statistics/:company_id', deleteStatistics);

router.post('/equity/dividends', createDividends);
router.get('/equity/dividends/:company_id', getDividendsByCompanyId);
router.put('/equity/dividends/:company_id', updateDividends);
router.delete('/equity/dividends/:company_id', deleteDividends);

router.post('/equity/earnings', createEarnings);
router.get('/equity/earnings/:company_id', getEarningsByCompanyId);
router.put('/equity/earnings/:company_id', updateEarnings);
router.delete('/equity/earnings/:company_id', deleteEarnings);

router.post('/equity/financial', createFinancial);
router.get('/equity/financial/:company_id', getFinancialByCompanyId);
router.put('/equity/financial/:company_id', updateFinancial);
router.delete('/equity/financial/:company_id', deleteFinancial);

router.post('/equity/holders', createHolders);
router.get('/equity/holders/:company_id', getHoldersByCompanyId);
router.put('/equity/holders/:company_id', updateHolders);
router.delete('/equity/holders/:company_id', deleteHolders);

router.post('/equity/price-history', createPriceHistory);
router.get('/equity/price-history/:company_id', getCompanyPriceHistory);
router.put('/equity/price-history/:company_id', updatePriceHistory);
router.delete('/equity/price-history/:company_id', deletePriceHistory);
router.get(
  '/equity/price-history/:company_id/24h',
  getCompanyPriceHistoryByLast24Hours,
);
router.get(
  '/equity/price-history/:company_id/1w',
  getCompanyPriceHistoryByLast1Week,
);
router.get(
  '/equity/price-history/:company_id/3m',
  getCompanyPriceHistoryByLast3Months,
);
router.get(
  '/equity/price-history/:company_id/6m',
  getCompanyPriceHistoryByLast6Months,
);
router.get(
  '/equity/price-history/:company_id/ytd',
  getCompanyPriceHistoryByYearToDate,
);
router.get(
  '/equity/price-history/:company_id/1y',
  getCompanyPriceHistoryByLast1Year,
);
router.get(
  '/equity/price-history/:company_id/2y',
  getCompanyPriceHistoryByLast2Years,
);
router.get(
  '/equity/price-history/:company_id/5y',
  getCompanyPriceHistoryByLast5Years,
);
router.get(
  '/equity/price-history/:company_id/10y',
  getCompanyPriceHistoryByLast10Years,
);
router.get(
  '/equity/price-history/:company_id/all',
  getCompanyAllTimePriceHistory,
);
router.post('/equity/price-history/:company_id/entries', addPriceEntry);
router.put('/equity/price-history/:company_id/latest', updateLatestPrice);

router.get('/equity/exchange/:exchangeSymbol/top-gainers', getTopGainersByExchange);
router.get('/equity/exchange/:exchangeSymbol/top-losers', getTopLosersByExchange);
router.get('/equity/exchange/:exchangeSymbol/performance-by-industry', getPerformanceByIndustry);
router.get('/equity/exchange/:exchangeSymbol/market-movers', getMarketMoversByExchange);

router.get('/equity/company/:company_id/all', getCompanyAllData);

router.get('/equity/gse/status', getGSEMarketStatus);
router.post('/equity/gse/status/update', manualGSEStatusUpdate);

router.post('/equity/bulk/profiles', bulkCreateProfiles);
router.put('/equity/bulk/profiles', bulkUpdateProfiles);
router.post('/equity/bulk/statistics', bulkCreateStatistics);
router.put('/equity/bulk/statistics', bulkUpdateStatistics);
router.post('/equity/bulk/price-history', bulkCreatePriceHistory);
router.post('/equity/bulk/price-history/entries', bulkAddPriceEntries);
router.post('/equity/bulk/upsert', bulkUpsertCollection);
router.delete('/equity/bulk/companies', bulkDeleteCompanies);
router.post('/equity/bulk/import', bulkImportCompanies);


// Key protected routes
router.post('/profiles', unifiedAuth, rateLimiter, createProfile);
router.get('/profiles/:company_id', unifiedAuth, rateLimiter, getProfileByCompanyId);
router.put('/profiles/:company_id', unifiedAuth, rateLimiter, updateProfile);
router.delete('/profiles/:company_id', unifiedAuth, rateLimiter, deleteProfile);

router.post('/statistics', unifiedAuth, rateLimiter, createStatistics);
router.get('/statistics/:company_id', unifiedAuth, rateLimiter, getStatisticsByCompanyId);
router.put('/statistics/:company_id', unifiedAuth, rateLimiter, updateStatistics);
router.delete('/statistics/:company_id', unifiedAuth, rateLimiter, deleteStatistics);

router.post('/dividends', unifiedAuth, rateLimiter, createDividends);
router.get('/dividends/:company_id', unifiedAuth, rateLimiter, getDividendsByCompanyId);
router.put('/dividends/:company_id', unifiedAuth, rateLimiter, updateDividends);
router.delete('/dividends/:company_id', unifiedAuth, rateLimiter, deleteDividends);

router.post('/earnings', unifiedAuth, rateLimiter, createEarnings);
router.get('/earnings/:company_id', unifiedAuth, rateLimiter, getEarningsByCompanyId);
router.put('/earnings/:company_id', unifiedAuth, rateLimiter, updateEarnings);
router.delete('/earnings/:company_id', unifiedAuth, rateLimiter, deleteEarnings);

router.post('/financial', unifiedAuth, rateLimiter, createFinancial);
router.get('/financial/:company_id', unifiedAuth, rateLimiter, getFinancialByCompanyId);
router.put('/financial/:company_id', unifiedAuth, rateLimiter, updateFinancial);
router.delete('/financial/:company_id', unifiedAuth, rateLimiter, deleteFinancial);

router.post('/holders', unifiedAuth, rateLimiter, createHolders);
router.get('/holders/:company_id', unifiedAuth, rateLimiter, getHoldersByCompanyId);
router.put('/holders/:company_id', unifiedAuth, rateLimiter, updateHolders);
router.delete('/holders/:company_id', unifiedAuth, rateLimiter, deleteHolders);

router.post('/price-history', unifiedAuth, rateLimiter, createPriceHistory);
router.get('/price-history/:company_id', unifiedAuth, rateLimiter, getCompanyPriceHistory);
router.put('/price-history/:company_id', unifiedAuth, rateLimiter, updatePriceHistory);
router.delete('/price-history/:company_id', unifiedAuth, rateLimiter, deletePriceHistory);
router.get(
  '/price-history/:company_id/24h', unifiedAuth, rateLimiter,
  getCompanyPriceHistoryByLast24Hours,
);
router.get(
  '/price-history/:company_id/1w', unifiedAuth, rateLimiter,
  getCompanyPriceHistoryByLast1Week,
);
router.get(
  '/price-history/:company_id/3m', unifiedAuth, rateLimiter,
  getCompanyPriceHistoryByLast3Months,
);
router.get(
  '/price-history/:company_id/6m', unifiedAuth, rateLimiter,
  getCompanyPriceHistoryByLast6Months,
);
router.get(
  '/price-history/:company_id/ytd', unifiedAuth, rateLimiter,
  getCompanyPriceHistoryByYearToDate,
);
router.get(
  '/price-history/:company_id/1y', unifiedAuth, rateLimiter,
  getCompanyPriceHistoryByLast1Year,
);
router.get(
  '/price-history/:company_id/2y', unifiedAuth, rateLimiter,
  getCompanyPriceHistoryByLast2Years,
);
router.get(
  '/price-history/:company_id/5y', unifiedAuth, rateLimiter,
  getCompanyPriceHistoryByLast5Years,
);
router.get(
  '/price-history/:company_id/10y', unifiedAuth, rateLimiter,
  getCompanyPriceHistoryByLast10Years,
);
router.get(
  '/price-history/:company_id/all', unifiedAuth, rateLimiter,
  getCompanyAllTimePriceHistory,
);
router.post('/price-history/:company_id/entries', unifiedAuth, rateLimiter, addPriceEntry);
router.put('/price-history/:company_id/latest', unifiedAuth, rateLimiter, updateLatestPrice);

router.get('/exchange/:exchangeSymbol/top-gainers', unifiedAuth, rateLimiter, getTopGainersByExchange);
router.get('/exchange/:exchangeSymbol/top-losers', unifiedAuth, rateLimiter, getTopLosersByExchange);
router.get('/exchange/:exchangeSymbol/performance-by-industry', unifiedAuth, rateLimiter, getPerformanceByIndustry);
router.get('/exchange/:exchangeSymbol/market-movers', unifiedAuth, rateLimiter, getMarketMoversByExchange);

router.get('/company/:company_id/all', unifiedAuth, rateLimiter, getCompanyAllData);

router.get('/gse/status', unifiedAuth, rateLimiter, getGSEMarketStatus);
router.post('/gse/status/update', unifiedAuth, rateLimiter, manualGSEStatusUpdate);

router.post('/bulk/profiles', unifiedAuth, rateLimiter, bulkCreateProfiles);
router.put('/bulk/profiles', unifiedAuth, rateLimiter, bulkUpdateProfiles);
router.post('/bulk/statistics', unifiedAuth, rateLimiter, bulkCreateStatistics);
router.put('/bulk/statistics', unifiedAuth, rateLimiter, bulkUpdateStatistics);
router.post('/bulk/price-history', unifiedAuth, rateLimiter, bulkCreatePriceHistory);
router.post('/bulk/price-history/entries', unifiedAuth, rateLimiter, bulkAddPriceEntries);
router.post('/bulk/upsert', unifiedAuth, rateLimiter, bulkUpsertCollection);
router.delete('/bulk/companies', unifiedAuth, rateLimiter, bulkDeleteCompanies);
router.post('/bulk/import', unifiedAuth, rateLimiter, bulkImportCompanies);

export default router;
