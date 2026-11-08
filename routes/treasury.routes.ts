import express from 'express';
import {
  createTreasuryBond,
  getAllTreasuryBonds,
  getTreasuryBond,
  updateTreasuryBond,
  deleteTreasuryBond,
  getActiveTreasuryBonds,
  getHighestYieldingBonds,
  calculateInvestmentReturn,
  bulkUpdateTreasuryBonds,
} from '../controllers/treasury.controller';

const router = express.Router();

router.get('/', getAllTreasuryBonds);
router.post('/', createTreasuryBond);
router.get('/active', getActiveTreasuryBonds);
router.get('/highest-yielding', getHighestYieldingBonds);
router.post('/bulk', bulkUpdateTreasuryBonds);
router.get('/:id', getTreasuryBond);
router.put('/:id', updateTreasuryBond);
router.delete('/:id', deleteTreasuryBond);
router.post('/:id/calculate', calculateInvestmentReturn);

export default router;
