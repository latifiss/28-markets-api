import type { NextFunction, Response } from 'express';
import type { AuthRequest } from './auth';
import { unifiedAuth } from './unifiedAuth';

/**
 * Enforces credentials for every /api/v1 request.
 * Registration and login are the only unauthenticated API operations because
 * they are required to obtain credentials for all other endpoints.
 */
export function requireApiAuthentication(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const method = req.method.toUpperCase();
  if (method === 'OPTIONS') return next();

  const path = req.originalUrl.split('?')[0];
  const isCredentialBootstrap =
    method === 'POST' &&
    (path === '/api/v1/auth/register' || path === '/api/v1/auth/login');

  if (isCredentialBootstrap) return next();
  return unifiedAuth(req, res, next);
}
