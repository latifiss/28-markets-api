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
import { unifiedAuth } from '../middleware/unifiedAuth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Public routes
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

// Key protected routes
router.post('/', unifiedAuth, rateLimiter, createCommodity);
router.get('/', unifiedAuth, rateLimiter, getAllCommodities);
router.get('/:code', unifiedAuth, rateLimiter, getCommodityByCode);
router.put('/:code', unifiedAuth, rateLimiter, updateCommodity);
router.delete('/:code', unifiedAuth, rateLimiter, deleteCommodity);
router.post('/:code/price', unifiedAuth, rateLimiter, updateCommodityPrice);

router.get('/:code/history', unifiedAuth, rateLimiter, getCommodityHistory);
router.post('/:code/history', unifiedAuth, rateLimiter, addCommodityHistory);
router.get('/:code/history/period/:period', unifiedAuth, rateLimiter, getCommodityHistoryByPeriod);
router.get('/:code/history/latest', unifiedAuth, rateLimiter, getLatestPriceHistory);

router.post('/:code/entries', unifiedAuth, rateLimiter, addPriceEntry);
router.put('/:code/latest', unifiedAuth, rateLimiter, updateLatestPrice);

router.put('/:code/history/:entryId', unifiedAuth, rateLimiter, updatePriceHistoryEntry);
router.delete('/:code/history/:entryId', unifiedAuth, rateLimiter, deletePriceHistoryEntry);
router.delete('/:code/history/clear/all', unifiedAuth, rateLimiter, clearPriceHistory);

export default router;