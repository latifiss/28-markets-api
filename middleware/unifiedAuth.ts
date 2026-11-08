import type { NextFunction, Response } from 'express';
import type { AuthRequest } from './auth';
import { authenticateApiKey } from './apiKey';
import { authenticateToken } from './auth';

export const unifiedAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  // The global mutation guard has already authenticated and admitted this request.
  if (req.mutationGuardPassed && req.user) return next();

  if (req.headers['x-api-key']) {
    return authenticateApiKey(req, res, next);
  }

  if (req.headers.authorization) {
    return authenticateToken(req, res, next);
  }

  return res.status(401).json({
    error: 'Authentication required. Provide JWT token or API key',
  });
};
