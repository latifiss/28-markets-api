import type { NextFunction, Response } from 'express';
import type { AuthRequest } from './auth';
import User from '../models/user';
import { checkRateLimit } from '../service/rateLimitChecker';
import type { PlanTier } from '../utils/tiers';

export const rateLimiter = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  if (req.mutationGuardPassed) return next();

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let tier = (req.tier || req.user?.tier) as PlanTier | undefined;
    if (!tier) {
      const user = await User.findById(userId).select('tier isActive').lean();
      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'User is not active' });
      }
      tier = user.tier;
      req.tier = tier;
    }

    const endpoint = req.route?.path
      ? `${req.baseUrl}${req.route.path}`
      : `${req.baseUrl}${req.path}`;
    const result = await checkRateLimit(userId, tier || 'free', endpoint, req.method);

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
    res.setHeader('X-User-Tier', tier || 'free');
    res.setHeader('X-Auth-Method', req.apiKeyId ? 'api-key' : 'jwt');
    return next();
  } catch (error) {
    console.error('Rate limiter unavailable:', error);
    return res.status(503).json({
      error: 'Request admission is temporarily unavailable. Please retry shortly.',
    });
  }
};
