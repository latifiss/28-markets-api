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

const router = express.Router();

router.post('/indices', createIndex);
router.put('/indices/:code', updateIndex);
router.delete('/indices/:code', deleteIndex);
router.post('/indices/:code/price', updateIndexPrice);

router.get('/indices', getAllIndices);
router.get('/indices/:code', getIndexByCode);
router.get('/indices/:code/history', getIndexHistory);

router.post('/indices/:code/history', addIndexHistory);

export default router;
