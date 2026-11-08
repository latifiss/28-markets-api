import type { NextFunction, Response } from 'express';
import type { AuthRequest } from './auth';
import { unifiedAuth } from './unifiedAuth';

const adminUserIds = new Set(
  (process.env.MARKET_DATA_ADMIN_USER_IDS || '')
    .split(',')
    .map((userId) => userId.trim())
    .filter(Boolean),
);

export function protectMutations(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
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
