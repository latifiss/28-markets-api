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

router.post('/treasury', createTreasuryBond);
router.put('/treasury/:id', updateTreasuryBond);
router.delete('/treasury/:id', deleteTreasuryBond);
router.post('/treasury/bulk', bulkUpdateTreasuryBonds);
router.get('/treasury', getAllTreasuryBonds);
router.get('/treasury/active', getActiveTreasuryBonds);
router.get('/treasury/highest-yielding', getHighestYieldingBonds);
router.get('/treasury/:id', getTreasuryBond);
router.post('/treasury/:id/calculate', calculateInvestmentReturn);

export default router;
