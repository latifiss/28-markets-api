"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("../controllers/auth.controller");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
const router = express_1.default.Router();
router.post('/register', rateLimit_1.authRateLimit, auth_controller_1.register);
router.post('/login', rateLimit_1.authRateLimit, auth_controller_1.login);
router.post('/api-key', auth_1.authenticateToken, auth_controller_1.generateNewApiKey);
router.get('/api-keys', auth_1.authenticateToken, auth_controller_1.getApiKeys);
router.get('/profile', auth_1.authenticateToken, auth_controller_1.getProfile);
exports.default = router;
//# sourceMappingURL=auth.js.map