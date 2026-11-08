import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/user';
import ApiKey from '../models/apiKey';
import { generateToken, type AuthRequest } from '../middleware/auth';
import { generateApiKey, revokeApiKeyById } from '../middleware/apiKey';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (
      !name ||
      name.length > 120 ||
      !EMAIL_PATTERN.test(email) ||
      password.length < 12 ||
      password.length > 128
    ) {
      res.status(400).json({
        error: 'Provide a valid name, email address, and password between 12 and 128 characters',
        code: 'INVALID_REGISTRATION_INPUT',
      });
      return;
    }

    const existingUser = await User.findOne({ email }).select('_id').lean();
    if (existingUser) {
      res.status(409).json({
        error: 'An account with this email already exists',
        code: 'EMAIL_IN_USE',
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ email, password: hashedPassword, name });
    const token = generateToken({
      userId: String(user._id),
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      data: {
        token,
        user: { id: user._id, email: user.email, name: user.name },
      },
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      res.status(409).json({
        error: 'An account with this email already exists',
        code: 'EMAIL_IN_USE',
      });
      return;
    }
    console.error('Registration failed:', error);
    res.status(500).json({ error: 'Unable to create account' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!EMAIL_PATTERN.test(email) || !password) {
      res.status(400).json({
        error: 'A valid email and password are required',
        code: 'INVALID_LOGIN_INPUT',
      });
      return;
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
      return;
    }

    const token = generateToken({
      userId: String(user._id),
      email: user.email,
      role: user.role,
    });

    res.json({
      data: {
        token,
        user: { id: user._id, email: user.email, name: user.name },
      },
    });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'Unable to authenticate' });
  }
};

export const generateNewApiKey = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const activeKeyCount = await ApiKey.countDocuments({ userId, revoked: false });

    if (activeKeyCount >= 10) {
      res.status(409).json({
        error: 'A maximum of 10 active API keys is allowed per account',
        code: 'API_KEY_LIMIT_REACHED',
      });
      return;
    }

    const description = typeof req.body?.description === 'string'
      ? req.body.description.trim().slice(0, 80)
      : undefined;
    const apiKey = await generateApiKey(userId, description);

    res.status(201).json({
      data: {
        apiKey,
        description: description || null,
        createdAt: new Date().toISOString(),
        warning: 'This key is shown once. Store it securely; it cannot be retrieved later.',
      },
    });
  } catch (error) {
    console.error('API key creation failed:', error);
    res.status(500).json({ error: 'Unable to create API key' });
  }
};

export const getApiKeys = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const keys = await ApiKey.find({
      userId: req.user!.userId,
      revoked: false,
    })
      .select('_id description createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ data: keys });
  } catch (error) {
    console.error('API key listing failed:', error);
    res.status(500).json({ error: 'Unable to list API keys' });
  }
};

export const deleteApiKey = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const keyId = String(req.params.keyId || '');
    if (!mongoose.isValidObjectId(keyId)) {
      res.status(404).json({
        error: 'API key not found',
        code: 'API_KEY_NOT_FOUND',
      });
      return;
    }

    const deleted = await revokeApiKeyById(req.user!.userId, keyId);
    if (!deleted) {
      res.status(404).json({
        error: 'API key not found',
        code: 'API_KEY_NOT_FOUND',
      });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('API key revocation failed:', error);
    res.status(500).json({ error: 'Unable to revoke API key' });
  }
};

export const getProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId)
      .select('email name role isActive createdAt updatedAt')
      .lean();

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ data: user });
  } catch (error) {
    console.error('Profile lookup failed:', error);
    res.status(500).json({ error: 'Unable to fetch profile' });
  }
};
