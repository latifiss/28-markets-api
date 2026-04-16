import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth';
import User from '../models/user';
import ApiUsage from '../models/apiUsage';
import { TIER_LIMITS, type PlanTier } from '../utils/tiers';

type TieredUsageOptions = {
  endpointKey?: string;
  allowedTiers?: PlanTier[];
};

type RateBucket = {
  count: number;
  windowStart: number;
};

const perMinuteBuckets = new Map<string, RateBucket>();

const getEndpointKey = (req: AuthRequest, explicit?: string): string => {
  if (explicit) return explicit;
  const base = req.baseUrl || '';
  const routePath = (req as any).route?.path ?? req.path;
  return `${req.method.toUpperCase()} ${base}${routePath}`;
};

const getMinuteWindowStart = (now: number): number =>
  Math.floor(now / 60000) * 60000;

export const tieredUsage =
  (options: TieredUsageOptions = {}) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authenticated user required' });
      }

      const user = await User.findById(userId);
      if (!user || !user.isActive) {
        return res.status(403).json({ error: 'User is not active' });
      }

      const tier: PlanTier = user.tier ?? 'free';
      req.tier = tier;

      if (options.allowedTiers && !options.allowedTiers.includes(tier)) {
        return res.status(403).json({
          error: 'Your subscription tier does not include this endpoint',
        });
      }

      const endpointKey = getEndpointKey(req, options.endpointKey);
      const now = Date.now();
      const minuteStart = getMinuteWindowStart(now);
      const identity = `${req.apiKey ?? userId}:${endpointKey}:${minuteStart}`;

      const limits = TIER_LIMITS[tier];

      const bucket = perMinuteBuckets.get(identity);
      if (!bucket) {
        perMinuteBuckets.set(identity, { count: 1, windowStart: minuteStart });
      } else {
        if (bucket.windowStart !== minuteStart) {
          bucket.windowStart = minuteStart;
          bucket.count = 1;
        } else {
          bucket.count += 1;
        }

        if (bucket.count > limits.perMinute) {
          if (bucket.count > limits.perMinute * 3) {
            console.warn(
              `[ABUSE] apiKey=${req.apiKey ?? 'none'} user=${userId} endpoint=${endpointKey} tier=${tier} count=${bucket.count} perMinuteLimit=${limits.perMinute}`
            );
          }
          return res.status(429).json({
            error: 'Per-minute rate limit exceeded for your tier',
          });
        }
      }

      if (!req.apiKeyId) {
        return next();
      }

      const nowDate = new Date();
      const month = nowDate.getMonth() + 1;
      const year = nowDate.getFullYear();

      const usage = await ApiUsage.findOneAndUpdate(
        {
          apiKeyId: req.apiKeyId,
          endpoint: endpointKey,
          method: req.method.toUpperCase(),
          month,
          year,
        },
        { $inc: { count: 1 } },
        { new: true, upsert: true }
      );

      if (usage.count > limits.monthlyRequests) {
        return res.status(429).json({
          error: 'Monthly request limit reached for your tier',
        });
      }

      return next();
    } catch (err) {
      console.error('Tiered usage middleware error', err);
      return res.status(500).json({ error: 'Usage tracking failed' });
    }
  };

