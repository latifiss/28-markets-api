"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPaystackWebhook = exports.updateUserAfterSuccessfulPayment = exports.cancelPaystackSubscription = exports.createBillingPortalSession = exports.verifyPaystackReference = exports.createCheckoutSession = exports.getAmountForTier = void 0;
const user_1 = __importDefault(require("../models/user"));
const paystack_1 = require("../utils/paystack");
const PAYSTACK_CALLBACK_URL = process.env.PAYSTACK_CALLBACK_URL || 'http://localhost:6060/api/billing/paystack/callback';
const PAYSTACK_SUCCESS_URL = process.env.PAYSTACK_SUCCESS_URL || 'http://localhost:3000/success';
const PAYSTACK_CANCEL_URL = process.env.PAYSTACK_CANCEL_URL || 'http://localhost:3000/cancel';
const PAYSTACK_DEFAULT_CURRENCY = process.env.PAYSTACK_DEFAULT_CURRENCY || 'NGN';
const PAYSTACK_PRO_AMOUNT = Number(process.env.PAYSTACK_PRO_AMOUNT || '500000');
const PAYSTACK_BUSINESS_AMOUNT = Number(process.env.PAYSTACK_BUSINESS_AMOUNT || '1500000');
const AMOUNTS = {
    pro: PAYSTACK_PRO_AMOUNT,
    business: PAYSTACK_BUSINESS_AMOUNT,
};
const getAmountForTier = (tier) => {
    if (tier === 'free') {
        return null;
    }
    return AMOUNTS[tier];
};
exports.getAmountForTier = getAmountForTier;
const createCheckoutSession = async (user, tier) => {
    const amount = (0, exports.getAmountForTier)(tier);
    if (!amount || amount <= 0) {
        throw new Error('Paystack amount not configured for selected tier.');
    }
    return (0, paystack_1.initializeTransaction)(user.email, amount, PAYSTACK_CALLBACK_URL, {
        userId: user._id.toString(),
        tier,
        cancelUrl: PAYSTACK_CANCEL_URL,
        currency: PAYSTACK_DEFAULT_CURRENCY,
    });
};
exports.createCheckoutSession = createCheckoutSession;
const verifyPaystackReference = async (reference) => {
    const transaction = await (0, paystack_1.verifyTransaction)(reference);
    if (transaction.status !== 'success') {
        throw new Error(`Paystack transaction ${reference} is not successful`);
    }
    await (0, exports.updateUserAfterSuccessfulPayment)({ data: transaction });
    return transaction;
};
exports.verifyPaystackReference = verifyPaystackReference;
const createBillingPortalSession = async () => {
    throw new Error('Paystack billing portal is not supported in this integration.');
};
exports.createBillingPortalSession = createBillingPortalSession;
const cancelPaystackSubscription = async () => {
    throw new Error('Subscription cancellation is not supported for Paystack one-time payment flow.');
};
exports.cancelPaystackSubscription = cancelPaystackSubscription;
const updateUserAfterSuccessfulPayment = async (payload) => {
    var _a;
    const metadata = ((_a = payload.data) === null || _a === void 0 ? void 0 : _a.metadata) || {};
    const userId = metadata.userId;
    const tier = metadata.tier;
    if (!userId || !tier) {
        return null;
    }
    const user = await user_1.default.findById(userId);
    if (!user) {
        return null;
    }
    user.tier = tier;
    user.subscriptionStatus = 'active';
    user.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await user.save();
    return user;
};
exports.updateUserAfterSuccessfulPayment = updateUserAfterSuccessfulPayment;
const verifyPaystackWebhook = (rawBody, signature) => {
    return (0, paystack_1.verifyWebhookSignature)(rawBody, signature);
};
exports.verifyPaystackWebhook = verifyPaystackWebhook;
//# sourceMappingURL=billing.js.map