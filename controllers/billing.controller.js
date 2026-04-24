"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paystackCallbackHandler = exports.paystackWebhookHandler = exports.cancelSubscriptionHandler = exports.getSubscriptionHandler = exports.createBillingPortalSessionHandler = exports.createCheckoutSessionHandler = void 0;
const user_1 = __importDefault(require("../models/user"));
const billing_1 = require("../service/billing");
const PAYSTACK_SUCCESS_URL = process.env.PAYSTACK_SUCCESS_URL || 'http://localhost:3000/success';
const PAYSTACK_CANCEL_URL = process.env.PAYSTACK_CANCEL_URL || 'http://localhost:3000/cancel';
const getRedirectUrl = (url, fallback) => url || fallback;
const createCheckoutSessionHandler = async (req, res) => {
    try {
        const tier = req.body.tier;
        if (!tier || tier === 'free') {
            res.status(400).json({ error: 'Invalid tier. Choose pro or business.' });
            return;
        }
        const user = await user_1.default.findById(req.user.userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        if (user.tier === tier) {
            res.status(400).json({ error: 'You already have this tier.' });
            return;
        }
        const session = await (0, billing_1.createCheckoutSession)(user, tier);
        res.status(201).json({ url: session.authorization_url, reference: session.reference });
    }
    catch (error) {
        console.error('createCheckoutSessionHandler error:', error);
        res.status(500).json({ error: error.message || 'Unable to create checkout session' });
    }
};
exports.createCheckoutSessionHandler = createCheckoutSessionHandler;
const createBillingPortalSessionHandler = async (req, res) => {
    res.status(400).json({ error: 'Billing portal is not supported for Paystack in this flow.' });
};
exports.createBillingPortalSessionHandler = createBillingPortalSessionHandler;
const getSubscriptionHandler = async (req, res) => {
    try {
        const user = await user_1.default.findById(req.user.userId).select('-password');
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                tier: user.tier,
                subscriptionStatus: user.subscriptionStatus,
                currentPeriodEnd: user.currentPeriodEnd,
            },
        });
    }
    catch (error) {
        console.error('getSubscriptionHandler error:', error);
        res.status(500).json({ error: error.message || 'Unable to fetch subscription' });
    }
};
exports.getSubscriptionHandler = getSubscriptionHandler;
const cancelSubscriptionHandler = async (req, res) => {
    res.status(400).json({ error: 'Cancel is not available for Paystack one-time upgrade payments.' });
};
exports.cancelSubscriptionHandler = cancelSubscriptionHandler;
const paystackWebhookHandler = async (req, res) => {
    var _a;
    try {
        const signature = req.headers['x-paystack-signature'];
        if (!signature || Array.isArray(signature)) {
            res.status(400).send('Missing Paystack signature');
            return;
        }
        const rawBody = req.body;
        const verified = (0, billing_1.verifyPaystackWebhook)(rawBody, signature);
        if (!verified) {
            res.status(400).send('Invalid Paystack webhook signature');
            return;
        }
        const event = JSON.parse(rawBody.toString('utf8'));
        if (event.event === 'charge.success' && ((_a = event.data) === null || _a === void 0 ? void 0 : _a.status) === 'success') {
            await (0, billing_1.updateUserAfterSuccessfulPayment)(event);
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        console.error('paystackWebhookHandler error:', error);
        res.status(400).send(`Webhook Error: ${error.message}`);
    }
};
exports.paystackWebhookHandler = paystackWebhookHandler;
const paystackCallbackHandler = async (req, res) => {
    try {
        const reference = String(req.query.reference || req.query.reference_code || '');
        if (!reference) {
            res.status(400).send('Missing Paystack reference');
            return;
        }
        const transaction = await (0, billing_1.verifyPaystackReference)(reference);
        res.redirect(`${PAYSTACK_SUCCESS_URL}?reference=${encodeURIComponent(reference)}`);
    }
    catch (error) {
        console.error('paystackCallbackHandler error:', error);
        res.redirect(`${PAYSTACK_CANCEL_URL}?error=${encodeURIComponent(error.message || 'payment_failed')}`);
    }
};
exports.paystackCallbackHandler = paystackCallbackHandler;
//# sourceMappingURL=billing.controller.js.map