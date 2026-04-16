import express from 'express';
import {
  getAllGoldbod,
  getGoldbodByCode,
  createGoldbod,
  updateGoldbod,
  deleteGoldbod,
  addPriceHistory,
  updatePriceHistory,
  getPriceHistory,
  getLatestPriceHistory,
  deletePriceHistoryEntry,
  clearPriceHistory,
} from '../controllers/goldbod.controller';

const router = express.Router();

router.get('/', getAllGoldbod);
router.post('/', createGoldbod);

router.get('/:code', getGoldbodByCode);
router.put('/:code', updateGoldbod);
router.delete('/:code', deleteGoldbod);

router.get('/price-history/:code', getPriceHistory);
router.post('/price-history/:code', addPriceHistory);
router.get('/price-history/:code/latest', getLatestPriceHistory);
router.put('/price-history/:code/:entryId', updatePriceHistory);
router.delete('/price-history/:code/:entryId', deletePriceHistoryEntry);
router.delete('/price-history/:code/clear/all', clearPriceHistory);

export default router;