"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const index_controller_1 = require("../controllers/index.controller");
const unifiedAuth_1 = require("../middleware/unifiedAuth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = express_1.default.Router();
router.post('/indices', index_controller_1.createIndex);
router.put('/indices/:code', index_controller_1.updateIndex);
router.delete('/indices/:code', index_controller_1.deleteIndex);
router.post('/indices/:code/price', index_controller_1.updateIndexPrice);
router.post('/indices/:code/history', index_controller_1.addIndexHistory);
router.get('/indices', index_controller_1.getAllIndices);
router.get('/indices/:code', index_controller_1.getIndexByCode);
router.get('/indices/:code/history', index_controller_1.getIndexHistory);
router.get('/', unifiedAuth_1.unifiedAuth, rateLimiter_1.rateLimiter, index_controller_1.getAllIndices);
router.get('/:code', unifiedAuth_1.unifiedAuth, rateLimiter_1.rateLimiter, index_controller_1.getIndexByCode);
router.get('//:code/history', unifiedAuth_1.unifiedAuth, rateLimiter_1.rateLimiter, index_controller_1.getIndexHistory);
router.post('/:code/history', index_controller_1.addIndexHistory);
exports.default = router;
//# sourceMappingURL=index.routes.js.map