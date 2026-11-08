import crypto from 'crypto';
import type { NextFunction, Response } from 'express';
import type { AuthRequest } from './auth';
import { getRedisClient } from '../lib/redis';
import { trackApiUsage } from '../service/usageTracker';

const WINDOW_MS = 60_000;
const TOKEN_BUCKET_SCRIPT = `
local values = redis.call('HMGET', KEYS[1], 'tokens', 'updatedAt')
local capacity = tonumber(ARGV[1])
local refill_per_ms = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
local tokens = tonumber(values[1]) or capacity
local updated_at = tonumber(values[2]) or now
local elapsed = math.max(0, now - updated_at)
tokens = math.min(capacity, tokens + elapsed * refill_per_ms)
local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end
redis.call('HSET', KEYS[1], 'tokens', tokens, 'updatedAt', now)
redis.call('PEXPIRE', KEYS[1], ttl)
local retry_ms = 0
if allowed == 0 then
  retry_ms = math.ceil((1 - tokens) / refill_per_ms)
end
return { allowed, math.floor(tokens), retry_ms }
`;

const FIXED_WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[1])) end
local ttl = redis.call('PTTL', KEYS[1])
return { count, ttl }
`;

const positiveInt = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
};

const digest = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

async function consumeBucket(
  redis: NonNullable<Awaited<ReturnType<typeof getRedisClient>>>,
  key: string,
  capacity: number,
): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
  const now = Date.now();
  const result = (await redis.eval(TOKEN_BUCKET_SCRIPT, {
    keys: [key],
    arguments: [
      String(capacity),
      String(capacity / WINDOW_MS),
      String(now),
      String(WINDOW_MS * 2),
    ],
  })) as number[];

  return {
    allowed: Number(result?.[0]) === 1,
    remaining: Math.max(0, Number(result?.[1] || 0)),
    retryAfter: Math.max(1, Math.ceil(Number(result?.[2] || 1) / 1000)),
  };
}

function unavailable(res: Response) {
  return res.status(503).json({
    error: 'Rate limiting is temporarily unavailable',
    code: 'RATE_LIMITER_UNAVAILABLE',
  });
}

export async function apiIpRateLimit(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const redis = await getRedisClient();
    if (!redis) return unavailable(res);

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const limit = positiveInt('API_IP_RATE_LIMIT_MAX', 1200);
    const result = await consumeBucket(redis, `28m:api-rl:v2:ip:${digest(ip)}`, limit);

    res.setHeader('RateLimit-Policy', `${limit};w=60`);
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(result.remaining));

    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfter));
      return res.status(429).json({
        type: 'about:blank',
        title: 'Too Many Requests',
        status: 429,
        detail: 'The request rate limit for this IP address has been exceeded.',
        code: 'IP_RATE_LIMIT_EXCEEDED',
        retryAfter: result.retryAfter,
      });
    }
    return next();
  } catch (error) {
    console.error('IP rate limiter failed:', error);
    return unavailable(res);
  }
}

const isReadOnlyPost = (req: AuthRequest): boolean => {
  if (req.method.toUpperCase() !== 'POST') return false;
  const path = req.originalUrl.split('?')[0];
  return [
    /^\/api\/v1\/forex\/pairs\/bulk\/(query|export)$/,
    /^\/api\/v1\/treasury\/bonds\/[^/]+\/calculate$/,
  ].some((pattern) => pattern.test(path));
};

export async function apiRateLimit(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const redis = await getRedisClient();
    if (!redis) return unavailable(res);

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const identity = req.apiKeyId
      ? `key:${req.apiKeyId}`
      : req.user?.userId
        ? `user:${req.user.userId}`
        : `anonymous:${ip}`;
    const writeRequest =
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase()) &&
      !isReadOnlyPost(req);
    const limit = writeRequest
      ? positiveInt('API_WRITE_RATE_LIMIT_MAX', 60)
      : positiveInt('API_RATE_LIMIT_MAX', 600);
    const result = await consumeBucket(
      redis,
      `28m:api-rl:v2:identity:${digest(identity)}`,
      limit,
    );

    res.setHeader('RateLimit-Policy', `${limit};w=60`);
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(result.remaining));

    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfter));
      return res.status(429).json({
        type: 'about:blank',
        title: 'Too Many Requests',
        status: 429,
        detail: 'The request rate limit has been exceeded. Retry after the indicated delay.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: result.retryAfter,
      });
    }

    const userId = req.user?.userId;
    if (userId) {
      res.once('finish', () => {
        const route = req.route?.path
          ? `${req.baseUrl}${req.route.path}`
          : req.path;
        void trackApiUsage(userId, route, req.method).catch((error) => {
          console.error('Unable to queue API usage event:', error);
        });
      });
    }

    return next();
  } catch (error) {
    console.error('Redis API rate limiter failed:', error);
    return unavailable(res);
  }
}

export async function authRateLimit(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const redis = await getRedisClient();
    if (!redis) return unavailable(res);

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const bucket = Math.floor(Date.now() / (15 * 60 * 1000));
    const key = `28m:auth-rl:v1:${digest(ip)}:${bucket}`;
    const result = (await redis.eval(FIXED_WINDOW_SCRIPT, {
      keys: [key],
      arguments: [String(15 * 60 * 1000)],
    })) as number[];

    const count = Number(result?.[0] || 0);
    const ttl = Math.max(1, Number(result?.[1] || 1));
    const limit = positiveInt('AUTH_RATE_LIMIT_MAX', 10);
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - count)));

    if (count > limit) {
      const retryAfter = Math.ceil(ttl / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        type: 'about:blank',
        title: 'Too Many Requests',
        status: 429,
        detail: 'Too many authentication attempts. Try again later.',
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        retryAfter,
      });
    }
    return next();
  } catch (error) {
    console.error('Authentication rate limiter failed:', error);
    return unavailable(res);
  }
}
