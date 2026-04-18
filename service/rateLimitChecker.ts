import { getMonthlyUsage } from './usageTracker';
import User from '../models/user';

const TIER_LIMITS = {
  free: { monthly: 1000, perMinute: 10 },
  pro: { monthly: 10000, perMinute: 100 },
  business: { monthly: 100000, perMinute: 500 },
};

const requestLogs = new Map<string, number[]>();

export const checkRateLimit = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    return { allowed: false, reason: 'User not found' };
  }

  const limits = TIER_LIMITS[user.tier];
  
  const monthlyUsage = await getMonthlyUsage(userId);
  
  if (monthlyUsage >= limits.monthly) {
    return {
      allowed: false,
      reason: 'Monthly request limit exceeded. Please upgrade your plan.',
      limit: limits.monthly,
      current: monthlyUsage,
    };
  }
  
  const now = Date.now();
  const userRequests = requestLogs.get(userId) || [];
  const recentRequests = userRequests.filter(timestamp => now - timestamp < 60000);
  
  if (recentRequests.length >= limits.perMinute) {
    return {
      allowed: false,
      reason: `Rate limit of ${limits.perMinute} requests per minute exceeded.`,
      limit: limits.perMinute,
    };
  }
  
  recentRequests.push(now);
  requestLogs.set(userId, recentRequests);
  
  return {
    allowed: true,
    remaining: limits.monthly - monthlyUsage,
    limit: limits.monthly,
  };
};

export const getTierLimits = (tier: string) => {
  return TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.free;
};