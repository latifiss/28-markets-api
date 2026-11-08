import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../db';
import { closeRedisClient, getRedisClient } from '../lib/redis';
import {
  persistUsageEvents,
  USAGE_QUEUE_KEY,
  type UsageEvent,
} from '../service/usageTracker';

const PROCESSING_QUEUE = `${USAGE_QUEUE_KEY}:processing`;
const BATCH_SIZE = Number(process.env.USAGE_WORKER_BATCH_SIZE || 500);
const POLL_INTERVAL_MS = Number(process.env.USAGE_WORKER_POLL_MS || 500);

async function recoverUnackedEvents(redis: any): Promise<void> {
  // Requeue events left in the processing list by a previous worker process.
  while (await redis.lMove(PROCESSING_QUEUE, USAGE_QUEUE_KEY, 'RIGHT', 'LEFT')) {
    // Continue until the processing list is empty.
  }
}

async function drainBatch(redis: any): Promise<number> {
  const rawEvents: string[] = [];

  for (let index = 0; index < BATCH_SIZE; index += 1) {
    const event = await redis.lMove(
      USAGE_QUEUE_KEY,
      PROCESSING_QUEUE,
      'LEFT',
      'RIGHT',
    );

    if (!event) break;
    rawEvents.push(event);
  }

  if (rawEvents.length === 0) return 0;

  try {
    const events: UsageEvent[] = [];

    for (const raw of rawEvents) {
      try {
        events.push(JSON.parse(raw) as UsageEvent);
      } catch {
        console.error('Discarding malformed usage event');
      }
    }

    await persistUsageEvents(events);

    for (const raw of rawEvents) {
      await redis.lRem(PROCESSING_QUEUE, 1, raw);
    }

    return rawEvents.length;
  } catch (error) {
    // At-least-once delivery: retry the batch if MongoDB persistence fails.
    for (let index = 0; index < rawEvents.length; index += 1) {
      await redis.lMove(PROCESSING_QUEUE, USAGE_QUEUE_KEY, 'RIGHT', 'LEFT');
    }
    throw error;
  }
}

async function run(): Promise<void> {
  await connectDB();

  const redis = await getRedisClient();
  if (!redis) throw new Error('Unable to connect to Redis');

  await recoverUnackedEvents(redis);
  console.info('Usage worker started');

  let stopping = false;
  process.once('SIGTERM', () => { stopping = true; });
  process.once('SIGINT', () => { stopping = true; });

  while (!stopping) {
    try {
      if ((await drainBatch(redis)) === 0) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (error) {
      console.error('Usage worker batch failed:', error);
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(POLL_INTERVAL_MS * 4, 5000)),
      );
    }
  }

  await Promise.allSettled([closeRedisClient(), mongoose.disconnect()]);
}

run().catch((error) => {
  console.error('Usage worker startup failed:', error);
  process.exitCode = 1;
});
