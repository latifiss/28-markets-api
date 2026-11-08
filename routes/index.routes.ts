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

router.post('/', createIndex);
router.put('//:code', updateIndex);
router.delete('//:code', deleteIndex);
router.post('//:code/price', updateIndexPrice);
router.post('//:code/history', addIndexHistory);

router.get('/', getAllIndices);
router.get('//:code', getIndexByCode);
router.get('//:code/history', getIndexHistory);

router.get('/', getAllIndices);
router.get('/:code', getIndexByCode);
router.get('/:code/history', getIndexHistory);

router.post('/:code/history', addIndexHistory);

export default router;