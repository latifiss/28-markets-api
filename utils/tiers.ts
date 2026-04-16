export type PlanTier = 'free' | 'pro' | 'business';

export const PLAN_ORDER: PlanTier[] = ['free', 'pro', 'business'];

export const TIER_LIMITS: Record<
  PlanTier,
  {
    monthlyRequests: number;
    perMinute: number;
  }
> = {
  free: {
    monthlyRequests: 1000,
    perMinute: 30,
  },
  pro: {
    monthlyRequests: 10000,
    perMinute: 120,
  },
  business: {
    monthlyRequests: 100000,
    perMinute: 600,
  },
};

export const compareTier = (a: PlanTier, b: PlanTier): number =>
  PLAN_ORDER.indexOf(a) - PLAN_ORDER.indexOf(b);

