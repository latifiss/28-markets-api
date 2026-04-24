"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const goldbod_controller_1 = require("../controllers/goldbod.controller");
const router = express_1.default.Router();
router.get('/', goldbod_controller_1.getAllGoldbod);
router.post('/', goldbod_controller_1.createGoldbod);
router.get('/:code', goldbod_controller_1.getGoldbodByCode);
router.put('/:code', goldbod_controller_1.updateGoldbod);
router.delete('/:code', goldbod_controller_1.deleteGoldbod);
router.get('/price-history/:code', goldbod_controller_1.getPriceHistory);
router.post('/price-history/:code', goldbod_controller_1.addPriceHistory);
router.get('/price-history/:code/latest', goldbod_controller_1.getLatestPriceHistory);
router.put('/price-history/:code/:entryId', goldbod_controller_1.updatePriceHistory);
router.delete('/price-history/:code/:entryId', goldbod_controller_1.deletePriceHistoryEntry);
router.delete('/price-history/:code/clear/all', goldbod_controller_1.clearPriceHistory);
exports.default = router;
//# sourceMappingURL=goldbod.routes.js.map