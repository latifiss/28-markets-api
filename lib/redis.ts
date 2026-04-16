import { createClient, RedisClientType } from 'redis';

const redisConfig = {
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  },
};

let client: RedisClientType | null = null;
let isConnecting = false;
let connectionPromise: Promise<RedisClientType> | null = null;

export const getRedisClient = async (): Promise<RedisClientType | null> => {
  if (client && client.isReady) {
    return client;
  }

  if (isConnecting && connectionPromise) {
    return connectionPromise;
  }

  isConnecting = true;
  console.log('🔌 Connecting to Redis...');

  connectionPromise = new Promise(async (resolve, reject) => {
    try {
      client = createClient(redisConfig);

      client.on('error', (err: Error) => {
        console.error('❌ Redis Client Error:', err);
        isConnecting = false;
        reject(err);
      });

      client.on('ready', () => {
        console.log('✅ Redis connected successfully!');
        isConnecting = false;
        resolve(client!);
      });

      await client.connect();
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      isConnecting = false;
      client = null;
      connectionPromise = null;
      reject(error);
    }
  });

  return connectionPromise;
};