import type { NextFunction, Response } from 'express';
import type { AuthRequest } from './auth';
import User from '../models/user';
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

export async function protectMutations(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();

  const path = req.originalUrl.split('?')[0];
  if (method === 'POST' && readOnlyPostPaths.some((pattern) => pattern.test(path))) {
    // Global API authentication has already validated the caller.
    return next();
  }

  return unifiedAuth(req, res, async () => {
    const userId = String(req.user?.userId || '');
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
      });
    }

    try {
      // Do not trust a potentially stale JWT role claim for privileged writes.
      // Re-read account state so deactivation or admin-role removal takes effect
      // immediately for all market-data mutation endpoints.
      const account = await User.findById(userId).select('role isActive').lean();
      const isAdministrator = Boolean(
        account?.isActive &&
        (account.role === 'admin' || adminUserIds.has(userId)),
      );

      if (!isAdministrator) {
        return res.status(403).json({
          error: 'Administrator privileges are required for market-data mutations',
          code: 'ADMIN_REQUIRED',
        });
      }

      req.mutationGuardPassed = true;
      return next();
    } catch (error) {
      console.error('Market-data authorization check failed:', error);
      return res.status(503).json({
        error: 'Authorization is temporarily unavailable',
        code: 'AUTHORIZATION_UNAVAILABLE',
      });
    }
  });
}
