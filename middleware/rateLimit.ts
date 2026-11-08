import type { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../lib/redis';

type LimitOptions = {
  prefix: string;
  windowMs: number;
  max: number;
  message: string;
};

const SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[1])) end
local ttl = redis.call('PTTL', KEYS[1])
return { count, ttl }
`;

const createRedisRateLimit = (options: LimitOptions) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const redis = await getRedisClient();
      if (!redis) {
        return res.status(503).json({
          error: 'Rate limiting is temporarily unavailable. Please retry shortly.',
        });
      }

      const identity = req.ip || req.socket.remoteAddress || 'unknown';
      const bucket = Math.floor(Date.now() / options.windowMs);
      const key = `28m:ratelimit:v1:${options.prefix}:${bucket}:${identity}`;
      const result = await redis.eval(SCRIPT, {
        keys: [key],
        arguments: [String(options.windowMs)],
      }) as number[];

      const count = Number(result?.[0] || 0);
      const ttl = Math.max(0, Number(result?.[1] || options.windowMs));
      const remaining = Math.max(0, options.max - count);

      res.setHeader('RateLimit-Limit', String(options.max));
      res.setHeader('RateLimit-Remaining', String(remaining));
      res.setHeader('RateLimit-Reset', String(Math.ceil((Date.now() + ttl) / 1000)));

      if (count > options.max) {
        res.setHeader('Retry-After', String(Math.ceil(ttl / 1000)));
        return res.status(429).json({ error: options.message });
      }

      return next();
    } catch (error) {
      console.error('Redis rate limiter failed:', error);
      return res.status(503).json({
        error: 'Rate limiting is temporarily unavailable. Please retry shortly.',
      });
    }
  };

export const generalRateLimit = createRedisRateLimit({
  prefix: 'general',
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});

export const authRateLimit = createRedisRateLimit({
  prefix: 'auth',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts, please try again later.',
});

export const apiKeyRateLimit = createRedisRateLimit({
  prefix: 'api-key',
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: 'API rate limit exceeded, please try again in an hour.',
});
