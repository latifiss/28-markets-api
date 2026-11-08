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

const router = express.Router();

// Public routes
router.post('/profiles', createProfile);
router.get('/profiles/:company_id', getProfileByCompanyId);
router.put('/profiles/:company_id', updateProfile);
router.delete('/profiles/:company_id', deleteProfile);

router.post('/statistics', createStatistics);
router.get('/statistics/:company_id', getStatisticsByCompanyId);
router.put('/statistics/:company_id', updateStatistics);
router.delete('/statistics/:company_id', deleteStatistics);

router.post('/dividends', createDividends);
router.get('/dividends/:company_id', getDividendsByCompanyId);
router.put('/dividends/:company_id', updateDividends);
router.delete('/dividends/:company_id', deleteDividends);

router.post('/earnings', createEarnings);
router.get('/earnings/:company_id', getEarningsByCompanyId);
router.put('/earnings/:company_id', updateEarnings);
router.delete('/earnings/:company_id', deleteEarnings);

router.post('/financial', createFinancial);
router.get('/financial/:company_id', getFinancialByCompanyId);
router.put('/financial/:company_id', updateFinancial);
router.delete('/financial/:company_id', deleteFinancial);

router.post('/holders', createHolders);
router.get('/holders/:company_id', getHoldersByCompanyId);
router.put('/holders/:company_id', updateHolders);
router.delete('/holders/:company_id', deleteHolders);

router.post('/price-history', createPriceHistory);
router.get('/price-history/:company_id', getCompanyPriceHistory);
router.put('/price-history/:company_id', updatePriceHistory);
router.delete('/price-history/:company_id', deletePriceHistory);
router.get(
  '/price-history/:company_id/24h',
  getCompanyPriceHistoryByLast24Hours,
);
router.get(
  '/price-history/:company_id/1w',
  getCompanyPriceHistoryByLast1Week,
);
router.get(
  '/price-history/:company_id/3m',
  getCompanyPriceHistoryByLast3Months,
);
router.get(
  '/price-history/:company_id/6m',
  getCompanyPriceHistoryByLast6Months,
);
router.get(
  '/price-history/:company_id/ytd',
  getCompanyPriceHistoryByYearToDate,
);
router.get(
  '/price-history/:company_id/1y',
  getCompanyPriceHistoryByLast1Year,
);
router.get(
  '/price-history/:company_id/2y',
  getCompanyPriceHistoryByLast2Years,
);
router.get(
  '/price-history/:company_id/5y',
  getCompanyPriceHistoryByLast5Years,
);
router.get(
  '/price-history/:company_id/10y',
  getCompanyPriceHistoryByLast10Years,
);
router.get(
  '/price-history/:company_id/all',
  getCompanyAllTimePriceHistory,
);
router.post('/price-history/:company_id/entries', addPriceEntry);
router.put('/price-history/:company_id/latest', updateLatestPrice);

router.get('/exchanges/:exchangeSymbol/top-gainers', getTopGainersByExchange);
router.get('/exchanges/:exchangeSymbol/top-losers', getTopLosersByExchange);
router.get('/exchanges/:exchangeSymbol/performance-by-industry', getPerformanceByIndustry);
router.get('/exchanges/:exchangeSymbol/market-movers', getMarketMoversByExchange);

router.get('/companies/:company_id/overview', getCompanyAllData);

router.get('/market/status', getGSEMarketStatus);
router.post('/market/status', manualGSEStatusUpdate);

router.post('/bulk/profiles', bulkCreateProfiles);
router.put('/bulk/profiles', bulkUpdateProfiles);
router.post('/bulk/statistics', bulkCreateStatistics);
router.put('/bulk/statistics', bulkUpdateStatistics);
router.post('/bulk/price-history', bulkCreatePriceHistory);
router.post('/bulk/price-history/entries', bulkAddPriceEntries);
router.post('/bulk/upsert', bulkUpsertCollection);
router.delete('/bulk/companies', bulkDeleteCompanies);
router.post('/bulk/import', bulkImportCompanies);


export default router;
