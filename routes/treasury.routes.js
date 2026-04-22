"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const treasury_controller_1 = require("../controllers/treasury.controller");
const router = express_1.default.Router();
router.post('/treasury', treasury_controller_1.createTreasuryBond);
router.put('/treasury/:id', treasury_controller_1.updateTreasuryBond);
router.delete('/treasury/:id', treasury_controller_1.deleteTreasuryBond);
router.post('/treasury/bulk', treasury_controller_1.bulkUpdateTreasuryBonds);
router.get('/treasury', treasury_controller_1.getAllTreasuryBonds);
router.get('/treasury/active', treasury_controller_1.getActiveTreasuryBonds);
router.get('/treasury/highest-yielding', treasury_controller_1.getHighestYieldingBonds);
router.get('/treasury/:id', treasury_controller_1.getTreasuryBond);
router.post('/treasury/:id/calculate', treasury_controller_1.calculateInvestmentReturn);
exports.default = router;
//# sourceMappingURL=treasury.routes.js.map