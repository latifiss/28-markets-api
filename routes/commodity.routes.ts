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

router.get('/', getAllCommodities);
router.post('/', createCommodity);
router.get('/:code', getCommodityByCode);
router.put('/:code', updateCommodity);
router.delete('/:code', deleteCommodity);
router.post('/:code/price', updateCommodityPrice);
router.get('/:code/history', getCommodityHistory);
router.post('/:code/history', addCommodityHistory);
router.get('/:code/history/period/:period', getCommodityHistoryByPeriod);
router.get('/:code/history/latest', getLatestPriceHistory);
router.post('/:code/entries', addPriceEntry);
router.put('/:code/latest', updateLatestPrice);
router.put('/:code/history/:entryId', updatePriceHistoryEntry);
router.delete('/:code/history/:entryId', deletePriceHistoryEntry);
router.delete('/:code/history', clearPriceHistory);

export default router;
