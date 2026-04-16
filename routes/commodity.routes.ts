import express from 'express';
import {
  getAllCommodities,
  getCommodityByCode,
  createCommodity,
  updateCommodity,
  deleteCommodity,
  getCommodityHistory,
  addCommodityHistory,
  updateCommodityPrice,
  addPriceEntry,
  updateLatestPrice,
  getCommodityHistoryByPeriod,
  getLatestPriceHistory,
  updatePriceHistoryEntry,
  deletePriceHistoryEntry,
  clearPriceHistory,
} from '../controllers/commodities.controller';

const router = express.Router();

router.post('/commodities', createCommodity);
router.get('/commodities', getAllCommodities);
router.get('/commodities/:code', getCommodityByCode);
router.put('/commodities/:code', updateCommodity);
router.delete('/commodities/:code', deleteCommodity);
router.post('/commodities/:code/price', updateCommodityPrice);

router.get('/commodities/:code/history', getCommodityHistory);
router.post('/commodities/:code/history', addCommodityHistory);
router.get('/commodities/:code/history/period/:period', getCommodityHistoryByPeriod);
router.get('/commodities/:code/history/latest', getLatestPriceHistory);

router.post('/commodities/:code/entries', addPriceEntry);
router.put('/commodities/:code/latest', updateLatestPrice);

router.put('/commodities/:code/history/:entryId', updatePriceHistoryEntry);
router.delete('/commodities/:code/history/:entryId', deletePriceHistoryEntry);
router.delete('/commodities/:code/history/clear/all', clearPriceHistory);

export default router;