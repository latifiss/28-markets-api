import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import type { PlanTier } from '../utils/tiers';
import User from '../models/user';
import {
  createCheckoutSession,
  updateUserAfterSuccessfulPayment,
  verifyPaystackWebhook,
  verifyPaystackReference,
} from '../service/billing';

const PAYSTACK_SUCCESS_URL = process.env.PAYSTACK_SUCCESS_URL || 'http://localhost:3000/success';
const PAYSTACK_CANCEL_URL = process.env.PAYSTACK_CANCEL_URL || 'http://localhost:3000/cancel';

const getRedirectUrl = (url: string | undefined, fallback: string) => url || fallback;

export const createCheckoutSessionHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tier = req.body.tier as PlanTier;
    if (!tier || tier === 'free') {
      res.status(400).json({ error: 'Invalid tier. Choose pro or business.' });
      return;
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.tier === tier) {
      res.status(400).json({ error: 'You already have this tier.' });
      return;
    }

    const session = await createCheckoutSession(user, tier);
    res.status(201).json({ url: session.authorization_url, reference: session.reference });
  } catch (error: any) {
    console.error('createCheckoutSessionHandler error:', error);
    res.status(500).json({ error: error.message || 'Unable to create checkout session' });
  }
};

export const createBillingPortalSessionHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(400).json({ error: 'Billing portal is not supported for Paystack in this flow.' });
};

export const getSubscriptionHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
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
  } catch (error: any) {
    console.error('getSubscriptionHandler error:', error);
    res.status(500).json({ error: error.message || 'Unable to fetch subscription' });
  }
};

export const cancelSubscriptionHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(400).json({ error: 'Cancel is not available for Paystack one-time upgrade payments.' });
};

export const paystackWebhookHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['x-paystack-signature'];
    if (!signature || Array.isArray(signature)) {
      res.status(400).send('Missing Paystack signature');
      return;
    }

    const rawBody = req.body as Buffer;
    const verified = verifyPaystackWebhook(rawBody, signature);
    if (!verified) {
      res.status(400).send('Invalid Paystack webhook signature');
      return;
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    if (event.event === 'charge.success' && event.data?.status === 'success') {
      await updateUserAfterSuccessfulPayment(event);
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('paystackWebhookHandler error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
};

export const paystackCallbackHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const reference = String(req.query.reference || req.query.reference_code || '');
    if (!reference) {
      res.status(400).send('Missing Paystack reference');
      return;
    }

    const transaction = await verifyPaystackReference(reference);
    res.redirect(`${PAYSTACK_SUCCESS_URL}?reference=${encodeURIComponent(reference)}`);
  } catch (error: any) {
    console.error('paystackCallbackHandler error:', error);
    res.redirect(`${PAYSTACK_CANCEL_URL}?error=${encodeURIComponent(error.message || 'payment_failed')}`);
  }
};
