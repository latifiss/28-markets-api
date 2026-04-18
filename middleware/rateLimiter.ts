import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { checkRateLimit } from '../service/rateLimitChecker';
import { trackApiUsage } from '../service/usageTracker';
import User from '../models/user';

export const rateLimiter = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userId = req.user.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const check = await checkRateLimit(userId);
    
    if (!check.allowed) {
      return res.status(429).json({
        error: check.reason,
        limit: check.limit,
        current: check.current,
        tier: user.tier,
      });
    }
    
    await trackApiUsage(userId, req.path, req.method);
    
    res.setHeader('X-RateLimit-Limit', check.limit);
    res.setHeader('X-RateLimit-Remaining', check.remaining);
    res.setHeader('X-User-Tier', user.tier);
    res.setHeader('X-Auth-Method', req.apiKey ? 'api-key' : 'jwt');
    
    next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    next();
  }
};