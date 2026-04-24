"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const forexInterbank_controller_1 = require("../controllers/forexInterbank.controller");
const router = express_1.default.Router();
router.post('/interbank-pairs', forexInterbank_controller_1.createInterbankPair);
router.get('/interbank-pairs', forexInterbank_controller_1.getAllInterbankPairs);
router.get('/interbank-pairs/:id', forexInterbank_controller_1.getInterbankPair);
router.put('/interbank-pairs/:id', forexInterbank_controller_1.updateInterbankPair);
router.delete('/interbank-pairs/:id', forexInterbank_controller_1.deleteInterbankPair);
router.put('/interbank-pairs/:id/prices', forexInterbank_controller_1.updatePrices);
router.get('/interbank-pairs/code/:code', forexInterbank_controller_1.getInterbankPairByCode);
router.get('/interbank-pairs/bank/:bankCode', forexInterbank_controller_1.getInterbankPairByBankCode);
router.get('/interbank-pairs/:id/history', forexInterbank_controller_1.getInterbankPairHistory);
router.post('/interbank-pairs/:id/history', forexInterbank_controller_1.addPriceHistory);
router.get('/price-history/:bankCode/period/:period', forexInterbank_controller_1.getInterbankPairHistoryByPeriod);
router.get('/price-history/:bankCode/latest', forexInterbank_controller_1.getLatestPriceHistory);
router.put('/price-history/:bankCode/:entryId', forexInterbank_controller_1.updatePriceHistoryEntry);
router.delete('/price-history/:bankCode/:entryId', forexInterbank_controller_1.deletePriceHistoryEntry);
router.delete('/price-history/:bankCode/clear/all', forexInterbank_controller_1.clearPriceHistory);
exports.default = router;
//# sourceMappingURL=forexInterbank.routes.js.map