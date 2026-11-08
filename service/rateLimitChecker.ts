import mongoose from 'mongoose';
import Usage from '../models/usage';
import { getRedisClient } from '../lib/redis';
import { USAGE_QUEUE_KEY } from './usageTracker';
import { TIER_LIMITS, type PlanTier } from '../utils/tiers';

const COUNTER_PREFIX = '28m:limits:v1';
const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

const secondsUntilMonthEnd = () => {
  const now = new Date();
  const nextMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return Math.max(60, Math.ceil((nextMonth - now.getTime()) / 1000));
};

const ADMISSION_SCRIPT = `
local monthlyRaw = redis.call('GET', KEYS[1])
local minute = tonumber(redis.call('GET', KEYS[2]) or '0')
if not monthlyRaw then
  return { -1, minute, -1 }
end
local monthly = tonumber(monthlyRaw)

if monthly >= tonumber(ARGV[2]) then
  return { monthly, minute, 0 }
end

if minute >= tonumber(ARGV[3]) then
  return { monthly, minute, 0 }
end

monthly = redis.call('INCR', KEYS[1])
if monthly == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end

minute = redis.call('INCR', KEYS[2])
if minute == 1 then
  redis.call('EXPIRE', KEYS[2], 60)
end

redis.call('RPUSH', KEYS[3], ARGV[4])
return { monthly, minute, 1 }
`;

export const checkRateLimit = async (
  userId: string,
  tier: PlanTier = 'free',
  endpoint = 'unknown',
  method = 'GET',
) => {
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
  const redis = await getRedisClient();

  if (!redis) {
    throw new Error('Shared Redis unavailable; cannot enforce quotas');
  }

  const month = getCurrentMonth();
  const minuteWindow = Math.floor(Date.now() / 60000);
  const monthlyKey = `${COUNTER_PREFIX}:monthly:${month}:${userId}`;
  const minuteKey = `${COUNTER_PREFIX}:minute:${minuteWindow}:${userId}`;

  const usageEvent = JSON.stringify({
    userId,
    endpoint,
    method: method.toUpperCase(),
    occurredAt: new Date().toISOString(),
  });

  const runAdmission = async () =>
    (await redis.eval(ADMISSION_SCRIPT, {
      keys: [monthlyKey, minuteKey, USAGE_QUEUE_KEY],
      arguments: [
        String(secondsUntilMonthEnd()),
        String(limits.monthlyRequests),
        String(limits.perMinute),
        usageEvent,
      ],
    })) as number[];

  let result = await runAdmission();

  // Only the first request after a month boundary (or Redis key loss) needs MongoDB.
  if (Number(result?.[2]) === -1) {
    const persisted = await Usage.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          yearMonth: month,
        },
      },
      { $group: { _id: null, total: { $sum: '$count' } } },
    ]);

    await redis.set(monthlyKey, String(persisted[0]?.total || 0), {
      NX: true,
      EX: secondsUntilMonthEnd(),
    });
    result = await runAdmission();
  }

  const monthlyUsage = Number(result?.[0] || 0);
  const minuteUsage = Number(result?.[1] || 0);
  const allowed = Number(result?.[2]) === 1;

  if (!allowed && monthlyUsage >= limits.monthlyRequests) {
    return {
      allowed: false,
      reason: 'Monthly request limit exceeded. Please upgrade your plan.',
      limit: limits.monthlyRequests,
      current: monthlyUsage,
      remaining: 0,
    };
  }

  if (!allowed) {
    return {
      allowed: false,
      reason: `Rate limit of ${limits.perMinute} requests per minute exceeded.`,
      limit: limits.perMinute,
      current: minuteUsage,
      remaining: Math.max(0, limits.monthlyRequests - monthlyUsage),
    };
  }

  return {
    allowed: true,
    limit: limits.monthlyRequests,
    current: monthlyUsage,
    remaining: Math.max(0, limits.monthlyRequests - monthlyUsage),
  };
};

export const getTierLimits = (tier: string) =>
  TIER_LIMITS[tier as PlanTier] || TIER_LIMITS.free;

export const getMonthlyUsage = async (userId: string): Promise<number> => {
  const redis = await getRedisClient();
  const key = `${COUNTER_PREFIX}:monthly:${getCurrentMonth()}:${userId}`;
  const cached = redis ? await redis.get(key) : null;

  if (cached !== null) return Number(cached) || 0;

  const persisted = await Usage.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        yearMonth: getCurrentMonth(),
      },
    },
    { $group: { _id: null, total: { $sum: '$count' } } },
  ]);

  return persisted[0]?.total || 0;
};
