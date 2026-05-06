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
import { unifiedAuth } from '../middleware/unifiedAuth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Public routes
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


// Key protected routes
router.post('/currency/', unifiedAuth, rateLimiter, createForex);
router.get('/currency/', unifiedAuth, rateLimiter, getAllForex);
router.get('/currency/:code', unifiedAuth, rateLimiter, getForex);
router.put('/currency/:code', unifiedAuth, rateLimiter, updateForex);
router.delete('/currency/:code', unifiedAuth, rateLimiter, deleteForex);
router.post('/currency/:code/price', unifiedAuth, rateLimiter, updateForexPrice);

router.get('/currency/:code/history', unifiedAuth, rateLimiter, getForexHistory);
router.post('/currency/:code/history', unifiedAuth, rateLimiter, addForexHistory);
router.get('/currency/:code/history/period/:period', unifiedAuth, rateLimiter, getForexHistoryByPeriod);
router.get('/currency/:code/history/latest', unifiedAuth, rateLimiter, getLatestPriceHistory);

router.post('/currency/:code/entries', unifiedAuth, rateLimiter, addPriceEntry);
router.put('/currency/:code/latest', unifiedAuth, rateLimiter, updateLatestPrice);

router.put('/currency/:code/history/:entryId', unifiedAuth, rateLimiter, updatePriceHistoryEntry);
router.delete('/currency/:code/history/:entryId', unifiedAuth, rateLimiter, deletePriceHistoryEntry);
router.delete('/currency/:code/history/clear/all', unifiedAuth, rateLimiter, clearPriceHistory);

router.post('/currency/bulk', unifiedAuth, rateLimiter, bulkCreateForex);
router.put('/currency/bulk', unifiedAuth, rateLimiter, bulkUpdateForex);
router.delete('/currency/bulk', unifiedAuth, rateLimiter, bulkDeleteForex);
router.post('/currency/bulk/upsert', unifiedAuth, rateLimiter, bulkUpsertForex);
router.post('/currency/bulk/prices', unifiedAuth, rateLimiter, bulkUpdateForexPrices);
router.post('/currency/bulk/history', unifiedAuth, rateLimiter, bulkAddPriceHistoryEntries);
router.post('/currency/bulk/import', unifiedAuth, rateLimiter, bulkImportForex);
router.post('/currency/bulk/query', unifiedAuth, rateLimiter, bulkGetForex);
router.post('/currency/bulk/export', unifiedAuth, rateLimiter, bulkExportForex);
router.post('/currency/bulk/sync', unifiedAuth, rateLimiter, bulkSyncForexPrices);

export default router;