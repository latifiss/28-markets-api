import { createClient } from 'redis';
type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;
let connectionPromise: Promise<RedisClient | null> | null = null;

function createRedisClient() {
  const url = process.env.REDIS_URL;

  if (url) {
    return createClient({
      url,
      socket: {
        connectTimeout: 10000,
        reconnectStrategy: (retries) => Math.min(retries * 250, 5000),
      },
    });
  }

  // Backward-compatible local development configuration.
  const host = process.env.REDIS_HOST;
  if (!host) return null;

  return createClient({
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    socket: {
      host,
      port: Number(process.env.REDIS_PORT || 6379),
      connectTimeout: 10000,
      reconnectStrategy: (retries) => Math.min(retries * 250, 5000),
    },
  });
}

export const getRedisClient = async (): Promise<RedisClient | null> => {
  if (client?.isReady) return client;
  if (connectionPromise) return connectionPromise;

  const redisClient = createRedisClient();
  if (!redisClient) return null;

  client = redisClient;
  redisClient.on('error', (error: Error) => {
    console.error('Redis client error:', error.message);
  });

  connectionPromise = (async () => {
    try {
      await redisClient.connect();
      console.info('Redis connected');
      return redisClient;
    } catch (error) {
      console.error('Redis connection failed:', error);
      client = null;
      try {
        redisClient.destroy();
      } catch {
        // The connection may already be closed.
      }
      return null;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
};

export const closeRedisClient = async (): Promise<void> => {
  const activeClient = client;
  client = null;
  connectionPromise = null;

  if (activeClient?.isOpen) {
    await activeClient.quit();
  }
};
