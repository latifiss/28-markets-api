import mongoose from 'mongoose';
import Usage from '../models/usage';

export const trackApiUsage = async (
  userId: string,
  endpoint: string,
  method: string
) => {
  const yearMonth = new Date().toISOString().slice(0, 7);
  
  await Usage.findOneAndUpdate(
    {
      userId: new mongoose.Types.ObjectId(userId),
      endpoint,
      yearMonth,
    },
    {
      $inc: { count: 1 },
      $set: {
        method: method.toUpperCase(),
        lastRequestAt: new Date(),
      },
    },
    {
      upsert: true,
      new: true,
    }
  );
};

export const getMonthlyUsage = async (userId: string): Promise<number> => {
  const yearMonth = new Date().toISOString().slice(0, 7);
  
  const result = await Usage.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        yearMonth,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$count' },
      },
    },
  ]);
  
  return result[0]?.total || 0;
};

export const getEndpointBreakdown = async (userId: string) => {
  const yearMonth = new Date().toISOString().slice(0, 7);
  
  return await Usage.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        yearMonth,
      },
    },
    {
      $group: {
        _id: '$endpoint',
        total: { $sum: '$count' },
      },
    },
    {
      $sort: { total: -1 },
    },
  ]);
};