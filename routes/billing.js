"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const billing_controller_1 = require("../controllers/billing.controller");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.post('/checkout-session', auth_1.authenticateToken, billing_controller_1.createCheckoutSessionHandler);
router.post('/portal-session', auth_1.authenticateToken, billing_controller_1.createBillingPortalSessionHandler);
router.get('/subscription', auth_1.authenticateToken, billing_controller_1.getSubscriptionHandler);
router.post('/cancel', auth_1.authenticateToken, billing_controller_1.cancelSubscriptionHandler);
router.get('/paystack/callback', billing_controller_1.paystackCallbackHandler);
router.post('/webhook', express_1.default.raw({ type: 'application/json' }), billing_controller_1.paystackWebhookHandler);
exports.default = router;
//# sourceMappingURL=billing.js.map