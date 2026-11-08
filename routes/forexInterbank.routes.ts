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

router.get('/', getAllInterbankPairs);
router.post('/', createInterbankPair);
router.get('/code/:code', getInterbankPairByCode);
router.get('/bank/:bankCode', getInterbankPairByBankCode);
router.get('/:id', getInterbankPair);
router.put('/:id', updateInterbankPair);
router.delete('/:id', deleteInterbankPair);
router.put('/:id/prices', updatePrices);
router.get('/:id/history', getInterbankPairHistory);
router.post('/:id/history', addPriceHistory);
router.get('/price-history/:bankCode/period/:period', getInterbankPairHistoryByPeriod);
router.get('/price-history/:bankCode/latest', getLatestPriceHistory);
router.put('/price-history/:bankCode/:entryId', updatePriceHistoryEntry);
router.delete('/price-history/:bankCode/:entryId', deletePriceHistoryEntry);
router.delete('/price-history/:bankCode', clearPriceHistory);

export default router;
