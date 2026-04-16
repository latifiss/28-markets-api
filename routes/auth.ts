import express from 'express';
import {
  register,
  login,
  generateNewApiKey,
  getProfile,
  getApiKeys,
} from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimit';
import { tieredUsage } from '../middleware/usage';

const router = express.Router();

router.post('/register', authRateLimit, register);
router.post('/login', authRateLimit, login);

router.post(
  '/api-key',
  authenticateToken,
  generateNewApiKey
);

router.get(
  '/api-keys',
  authenticateToken,
  getApiKeys
);

router.get(
  '/profile',
  authenticateToken,
  getProfile
);

export default router;