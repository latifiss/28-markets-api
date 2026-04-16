import express from 'express';
import {
  createInterbankPair,
  updateInterbankPair,
  deleteInterbankPair,
  getAllInterbankPairs,
  getInterbankPair,
  getInterbankPairHistory,
  getInterbankPairHistoryByPeriod,
  addPriceHistory,
  getInterbankPairByCode,
  updatePrices,
  getInterbankPairByBankCode,
  getLatestPriceHistory,
  updatePriceHistoryEntry,
  deletePriceHistoryEntry,
  clearPriceHistory,
} from '../controllers/forexInterbank.controller';

const router = express.Router();

router.post('/interbank-pairs', createInterbankPair);
router.get('/interbank-pairs', getAllInterbankPairs);
router.get('/interbank-pairs/:id', getInterbankPair);
router.put('/interbank-pairs/:id', updateInterbankPair);
router.delete('/interbank-pairs/:id', deleteInterbankPair);
router.put('/interbank-pairs/:id/prices', updatePrices);

router.get('/interbank-pairs/code/:code', getInterbankPairByCode);
router.get('/interbank-pairs/bank/:bankCode', getInterbankPairByBankCode);

router.get('/interbank-pairs/:id/history', getInterbankPairHistory);
router.post('/interbank-pairs/:id/history', addPriceHistory);

router.get('/price-history/:bankCode/period/:period', getInterbankPairHistoryByPeriod);
router.get('/price-history/:bankCode/latest', getLatestPriceHistory);
router.put('/price-history/:bankCode/:entryId', updatePriceHistoryEntry);
router.delete('/price-history/:bankCode/:entryId', deletePriceHistoryEntry);
router.delete('/price-history/:bankCode/clear/all', clearPriceHistory);

export default router;