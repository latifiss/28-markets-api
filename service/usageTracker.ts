import mongoose from 'mongoose';
import Usage from '../models/usage';
import { getRedisClient } from '../lib/redis';

export const USAGE_QUEUE_KEY = '28m:queue:usage:v1';

export type UsageEvent = {
  userId: string;
  endpoint: string;
  method: string;
  occurredAt: string;
};

export const trackApiUsage = async (
  userId: string,
  endpoint: string,
  method: string,
): Promise<void> => {
  const redis = await getRedisClient();
  if (!redis) throw new Error('Redis unavailable; usage event could not be queued');

  const event: UsageEvent = {
    userId,
    endpoint,
    method: method.toUpperCase(),
    occurredAt: new Date().toISOString(),
  };

  await redis.rPush(USAGE_QUEUE_KEY, JSON.stringify(event));
};

export const persistUsageEvents = async (events: UsageEvent[]): Promise<void> => {
  const grouped = new Map<
    string,
    {
      userId: string;
      endpoint: string;
      method: string;
      yearMonth: string;
      count: number;
      lastRequestAt: Date;
    }
  >();

  for (const event of events) {
    if (!mongoose.isValidObjectId(event.userId)) continue;

    const occurredAt = new Date(event.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) continue;

    const yearMonth = occurredAt.toISOString().slice(0, 7);
    const key = [event.userId, event.endpoint, event.method, yearMonth].join('|');
    const existing = grouped.get(key);

    if (existing) {
      existing.count += 1;
      if (occurredAt > existing.lastRequestAt) {
        existing.lastRequestAt = occurredAt;
      }
    } else {
      grouped.set(key, {
        userId: event.userId,
        endpoint: event.endpoint,
        method: event.method,
        yearMonth,
        count: 1,
        lastRequestAt: occurredAt,
      });
    }
  }

  const operations = Array.from(grouped.values()).map((event) => ({
    updateOne: {
      filter: {
        userId: new mongoose.Types.ObjectId(event.userId),
        endpoint: event.endpoint,
        method: event.method,
        yearMonth: event.yearMonth,
      },
      update: {
        $inc: { count: event.count },
        $set: {
          method: event.method,
          lastRequestAt: event.lastRequestAt,
        },
      },
      upsert: true,
    },
  }));

  if (operations.length) {
    await Usage.bulkWrite(operations, { ordered: false });
  }
};

export const getEndpointBreakdown = async (userId: string) => {
  const yearMonth = new Date().toISOString().slice(0, 7);

  return Usage.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        yearMonth,
      },
    },
    { $group: { _id: '$endpoint', total: { $sum: '$count' } } },
    { $sort: { total: -1 } },
  ]);
};
