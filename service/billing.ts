import type { PlanTier } from '../utils/tiers';
import type { IUser } from '../models/user';
import User from '../models/user';
import { initializeTransaction, verifyWebhookSignature, verifyTransaction } from '../utils/paystack';

const PAYSTACK_CALLBACK_URL = process.env.PAYSTACK_CALLBACK_URL || 'http://localhost:6060/api/billing/paystack/callback';
const PAYSTACK_SUCCESS_URL = process.env.PAYSTACK_SUCCESS_URL || 'http://localhost:3000/success';
const PAYSTACK_CANCEL_URL = process.env.PAYSTACK_CANCEL_URL || 'http://localhost:3000/cancel';
const PAYSTACK_DEFAULT_CURRENCY = process.env.PAYSTACK_DEFAULT_CURRENCY || 'NGN';
const PAYSTACK_PRO_AMOUNT = Number(process.env.PAYSTACK_PRO_AMOUNT || '500000');
const PAYSTACK_BUSINESS_AMOUNT = Number(process.env.PAYSTACK_BUSINESS_AMOUNT || '1500000');

const AMOUNTS: Record<Exclude<PlanTier, 'free'>, number> = {
  pro: PAYSTACK_PRO_AMOUNT,
  business: PAYSTACK_BUSINESS_AMOUNT,
};

export const getAmountForTier = (tier: PlanTier): number | null => {
  if (tier === 'free') {
    return null;
  }
  return AMOUNTS[tier];
};

export const createCheckoutSession = async (user: IUser, tier: Exclude<PlanTier, 'free'>) => {
  const amount = getAmountForTier(tier);
  if (!amount || amount <= 0) {
    throw new Error('Paystack amount not configured for selected tier.');
  }

  return initializeTransaction(user.email, amount, PAYSTACK_CALLBACK_URL, {
    userId: user._id.toString(),
    tier,
    cancelUrl: PAYSTACK_CANCEL_URL,
    currency: PAYSTACK_DEFAULT_CURRENCY,
  });
};

export const verifyPaystackReference = async (reference: string) => {
  const transaction = await verifyTransaction(reference);
  if (transaction.status !== 'success') {
    throw new Error(`Paystack transaction ${reference} is not successful`);
  }
  await updateUserAfterSuccessfulPayment({ data: transaction });
  return transaction;
};

export const createBillingPortalSession = async (): Promise<never> => {
  throw new Error('Paystack billing portal is not supported in this integration.');
};

export const cancelPaystackSubscription = async (): Promise<never> => {
  throw new Error('Subscription cancellation is not supported for Paystack one-time payment flow.');
};

export const updateUserAfterSuccessfulPayment = async (payload: any) => {
  const metadata = payload.data?.metadata || {};
  const userId = metadata.userId;
  const tier = metadata.tier as Exclude<PlanTier, 'free'>;

  if (!userId || !tier) {
    return null;
  }

  const user = await User.findById(userId);
  if (!user) {
    return null;
  }

  user.tier = tier;
  user.subscriptionStatus = 'active';
  user.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await user.save();

  return user;
};

export const verifyPaystackWebhook = (rawBody: Buffer, signature: string): boolean => {
  return verifyWebhookSignature(rawBody, signature);
};
