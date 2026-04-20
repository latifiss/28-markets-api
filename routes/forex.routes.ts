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
  bulkCreateForex,
  bulkUpdateForex,
  bulkDeleteForex,
  bulkUpsertForex,
  bulkUpdateForexPrices,
  bulkAddPriceHistoryEntries,
  bulkImportForex,
  bulkGetForex,
  bulkExportForex,
  bulkSyncForexPrices,
} from '../controllers/forex.controller';

const router = express.Router();

router.post('/', createForex);
router.get('/', getAllForex);
router.get('/:code', getForex);
router.put('/:code', updateForex);
router.delete('/:code', deleteForex);
router.post('/:code/price', updateForexPrice);

router.get('/:code/history', getForexHistory);
router.post('/:code/history', addForexHistory);
router.get('/:code/history/period/:period', getForexHistoryByPeriod);
router.get('/:code/history/latest', getLatestPriceHistory);

router.post('/:code/entries', addPriceEntry);
router.put('/:code/latest', updateLatestPrice);

router.put('/:code/history/:entryId', updatePriceHistoryEntry);
router.delete('/:code/history/:entryId', deletePriceHistoryEntry);
router.delete('/:code/history/clear/all', clearPriceHistory);

router.post('/bulk', bulkCreateForex);
router.put('/bulk', bulkUpdateForex);
router.delete('/bulk', bulkDeleteForex);
router.post('/bulk/upsert', bulkUpsertForex);
router.post('/bulk/prices', bulkUpdateForexPrices);
router.post('/bulk/history', bulkAddPriceHistoryEntries);
router.post('/bulk/import', bulkImportForex);
router.post('/bulk/query', bulkGetForex);
router.post('/bulk/export', bulkExportForex);
router.post('/bulk/sync', bulkSyncForexPrices);

export default router;