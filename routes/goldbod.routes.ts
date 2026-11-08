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

router.get('/:code/history', getPriceHistory);
router.post('/:code/history', addPriceHistory);
router.get('/:code/history/latest', getLatestPriceHistory);
router.put('/:code/history/:entryId', updatePriceHistory);
router.delete('/:code/history/:entryId', deletePriceHistoryEntry);
router.delete('/:code/history', clearPriceHistory);

export default router;