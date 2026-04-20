import express from 'express';
import {
  createIndex,
  updateIndex,
  getAllIndices,
  getIndexByCode,
  deleteIndex,
  getIndexHistory,
  addIndexHistory,
  updateIndexPrice,
} from '../controllers/index.controller';
import { unifiedAuth } from '../middleware/unifiedAuth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

router.post('/indices', createIndex);
router.put('/indices/:code', updateIndex);
router.delete('/indices/:code', deleteIndex);
router.post('/indices/:code/price', updateIndexPrice);
router.post('/indices/:code/history', addIndexHistory);

router.get('/indices', getAllIndices);
router.get('/indices/:code', getIndexByCode);
router.get('/indices/:code/history', getIndexHistory);

router.get('/', unifiedAuth, rateLimiter, getAllIndices);
router.get('/:code', unifiedAuth, rateLimiter, getIndexByCode);
router.get('//:code/history', unifiedAuth, rateLimiter, getIndexHistory);

router.post('/:code/history', addIndexHistory);

export default router;