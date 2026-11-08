import express from 'express';
import {
  register,
  login,
  generateNewApiKey,
  getProfile,
  getApiKeys,
  deleteApiKey,
} from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimit';

const router = express.Router();

router.post('/register', authRateLimit, register);
router.post('/login', authRateLimit, login);
router.get('/me', authenticateToken, getProfile);
router.get('/api-keys', authenticateToken, getApiKeys);
router.post('/api-keys', authenticateToken, generateNewApiKey);
router.delete('/api-keys/:keyId', authenticateToken, deleteApiKey);

export default router;
