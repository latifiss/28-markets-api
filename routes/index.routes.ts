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

router.get('/', getAllIndices);
router.post('/', createIndex);
router.get('/:code', getIndexByCode);
router.put('/:code', updateIndex);
router.delete('/:code', deleteIndex);
router.post('/:code/price', updateIndexPrice);
router.get('/:code/history', getIndexHistory);
router.post('/:code/history', addIndexHistory);

export default router;
