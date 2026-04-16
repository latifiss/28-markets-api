import express from 'express';
import {
  createForex,
  getAllForex,
  getForex,
  updateForex,
  deleteForex,
  getForexHistory,
  addForexHistory,
  updateForexPrice,
  addPriceEntry,
  updateLatestPrice,
  getForexHistoryByPeriod,
  getLatestPriceHistory,
  updatePriceHistoryEntry,
  deletePriceHistoryEntry,
  clearPriceHistory,
} from '../controllers/forex.controller';

const router = express.Router();

router.post('/forex', createForex);
router.get('/forex', getAllForex);
router.get('/forex/:code', getForex);
router.put('/forex/:code', updateForex);
router.delete('/forex/:code', deleteForex);
router.post('/forex/:code/price', updateForexPrice);

router.get('/forex/:code/history', getForexHistory);
router.post('/forex/:code/history', addForexHistory);
router.get('/forex/:code/history/period/:period', getForexHistoryByPeriod);
router.get('/forex/:code/history/latest', getLatestPriceHistory);

router.post('/forex/:code/entries', addPriceEntry);
router.put('/forex/:code/latest', updateLatestPrice);

router.put('/forex/:code/history/:entryId', updatePriceHistoryEntry);
router.delete('/forex/:code/history/:entryId', deletePriceHistoryEntry);
router.delete('/forex/:code/history/clear/all', clearPriceHistory);

export default router;