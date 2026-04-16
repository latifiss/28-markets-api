import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/user';
import ApiKey from '../models/apiKey';
import { generateToken } from '../middleware/auth';
import { generateApiKey } from '../middleware/apiKey';
import type { AuthRequest } from '../middleware/auth';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({ email, password: hashedPassword, name });
    await user.save();

    const token = generateToken({ userId: String(user._id), email: user.email });

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken({ userId: String(user._id), email: user.email });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const generateNewApiKey = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const apiKey = await generateApiKey(userId);
    res.json({ message: 'API key generated successfully', apiKey, createdAt: new Date() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getApiKeys = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const keys = await ApiKey.find({ userId, revoked: false }).select('-__v');
    res.json({ apiKeys: keys });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: { id: user._id, email: user.email, name: user.name, isActive: user.isActive } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};