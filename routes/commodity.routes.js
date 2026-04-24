"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const commodities_controller_1 = require("../controllers/commodities.controller");
const router = express_1.default.Router();
router.post('/commodities', commodities_controller_1.createCommodity);
router.get('/commodities', commodities_controller_1.getAllCommodities);
router.get('/commodities/:code', commodities_controller_1.getCommodityByCode);
router.put('/commodities/:code', commodities_controller_1.updateCommodity);
router.delete('/commodities/:code', commodities_controller_1.deleteCommodity);
router.post('/commodities/:code/price', commodities_controller_1.updateCommodityPrice);
router.get('/commodities/:code/history', commodities_controller_1.getCommodityHistory);
router.post('/commodities/:code/history', commodities_controller_1.addCommodityHistory);
router.get('/commodities/:code/history/period/:period', commodities_controller_1.getCommodityHistoryByPeriod);
router.get('/commodities/:code/history/latest', commodities_controller_1.getLatestPriceHistory);
router.post('/commodities/:code/entries', commodities_controller_1.addPriceEntry);
router.put('/commodities/:code/latest', commodities_controller_1.updateLatestPrice);
router.put('/commodities/:code/history/:entryId', commodities_controller_1.updatePriceHistoryEntry);
router.delete('/commodities/:code/history/:entryId', commodities_controller_1.deletePriceHistoryEntry);
router.delete('/commodities/:code/history/clear/all', commodities_controller_1.clearPriceHistory);
exports.default = router;
//# sourceMappingURL=commodity.routes.js.map