import type { NextFunction, Response } from 'express';
import type { AuthRequest } from './auth';
import { unifiedAuth } from './unifiedAuth';

const adminUserIds = new Set(
  (process.env.MARKET_DATA_ADMIN_USER_IDS || '')
    .split(',')
    .map((userId) => userId.trim())
    .filter(Boolean),
);

const readOnlyPostPaths = [
  /^\/api\/v1\/forex\/pairs\/bulk\/(query|export)$/,
  /^\/api\/v1\/treasury\/bonds\/[^/]+\/calculate$/,
];

export function protectMutations(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();

  const path = req.originalUrl.split('?')[0];
  if (method === 'POST' && readOnlyPostPaths.some((pattern) => pattern.test(path))) {
    return next();
  }

  return unifiedAuth(req, res, () => {
    const isAdministrator =
      req.user?.role === 'admin' ||
      adminUserIds.has(String(req.user?.userId || ''));

    if (!isAdministrator) {
      return res.status(403).json({
        error: 'Administrator privileges are required for market-data mutations',
        code: 'ADMIN_REQUIRED',
      });
    }

    req.mutationGuardPassed = true;
    return next();
  });
}
