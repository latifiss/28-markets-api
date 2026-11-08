import type { Request, Response, NextFunction } from 'express';
import { getCache, setCache, publicResponseCacheKey } from '../lib/cache';

const TTL = Math.max(1, Number(process.env.PUBLIC_RESPONSE_CACHE_TTL_SECONDS || 15));

export async function publicResponseCache(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const path = req.originalUrl.split('?')[0];
  if (
    req.method !== 'GET' ||
    !path.startsWith('/api/v1/') ||
    path.startsWith('/api/v1/auth/') ||
    path.startsWith('/api/v1/account/') ||
    req.headers.authorization ||
    req.headers['x-api-key'] ||
    req.headers.cookie
  ) {
    return next();
  }

  try {
    const key = publicResponseCacheKey(req.originalUrl);
    const hit = await getCache<{ body: unknown }>(key);
    if (hit) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, s-maxage=${TTL}, stale-while-revalidate=30`);
      return res.status(200).json(hit.body);
    }

    const send = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode === 200 && body !== undefined && !res.headersSent) {
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Cache-Control', `public, s-maxage=${TTL}, stale-while-revalidate=30`);
        void setCache(key, { body }, TTL);
      }
      return send(body);
    }) as Response['json'];
    return next();
  } catch (error) {
    console.error('Public response cache bypassed:', error);
    return next();
  }
}
