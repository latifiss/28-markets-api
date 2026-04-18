import express from 'express';
import {
  createCheckoutSessionHandler,
  createBillingPortalSessionHandler,
  getSubscriptionHandler,
  cancelSubscriptionHandler,
  paystackWebhookHandler,
  paystackCallbackHandler,
} from '../controllers/billing.controller';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.post('/checkout-session', authenticateToken, createCheckoutSessionHandler);
router.post('/portal-session', authenticateToken, createBillingPortalSessionHandler);
router.get('/subscription', authenticateToken, getSubscriptionHandler);
router.post('/cancel', authenticateToken, cancelSubscriptionHandler);
router.get('/paystack/callback', paystackCallbackHandler);
router.post('/webhook', express.raw({ type: 'application/json' }), paystackWebhookHandler);

export default router;
