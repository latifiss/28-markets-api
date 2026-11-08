import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth';
import User from '../models/user';
import { checkRateLimit } from '../service/rateLimitChecker';
import type { PlanTier } from '../utils/tiers';

type TieredUsageOptions = {
  endpointKey?: string;
  allowedTiers?: PlanTier[];
};

const getEndpointKey = (req: AuthRequest, explicit?: string): string => {
  if (explicit) return explicit;
  const routePath = req.route?.path ?? req.path;
  return `${req.method.toUpperCase()} ${req.baseUrl || ''}${routePath}`;
};

export const tieredUsage =
  (options: TieredUsageOptions = {}) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authenticated user required' });
      }

      let tier = (req.tier || req.user?.tier) as PlanTier | undefined;
      if (!tier) {
        const user = await User.findById(userId).select('tier isActive').lean();
        if (!user || !user.isActive) {
          return res.status(403).json({ error: 'User is not active' });
        }
        tier = user.tier;
        req.tier = tier;
      }

      if (options.allowedTiers && !options.allowedTiers.includes(tier)) {
        return res.status(403).json({
          error: 'Your subscription tier does not include this endpoint',
        });
      }

      const endpointKey = getEndpointKey(req, options.endpointKey);
      const result = await checkRateLimit(userId, tier, endpointKey, req.method);

      if (!result.allowed) {
        return res.status(429).json({
          error: result.reason,
          limit: result.limit,
          current: result.current,
          tier,
        });
      }

      res.setHeader('X-RateLimit-Limit', String(result.limit));
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      return next();
    } catch (error) {
      console.error('Tiered usage middleware error:', error);
      return res.status(503).json({
        error: 'Request admission is temporarily unavailable. Please retry shortly.',
      });
    }
  };
