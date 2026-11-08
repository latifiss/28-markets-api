import mongoose from 'mongoose';

let isDBConnected = false;
const connectionCallbacks: (() => void)[] = [];

export const connectDB = async (): Promise<typeof mongoose> => {
  if (mongoose.connection.readyState === 1) {
    isDBConnected = true;
    return mongoose;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  const configuredPoolSize = Number(process.env.MONGODB_MAX_POOL_SIZE || 10);
  const maxPoolSize =
    Number.isInteger(configuredPoolSize) && configuredPoolSize > 0
      ? configuredPoolSize
      : 10;

  console.info('Connecting to MongoDB...');
  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DATABASE || 'api',
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize,
    minPoolSize: 0,
    retryWrites: true,
    retryReads: true,
  });

  isDBConnected = true;
  console.info('MongoDB connected');

  connectionCallbacks.splice(0).forEach((callback) => callback());
  return mongoose;
};

mongoose.connection.on('disconnected', () => {
  isDBConnected = false;
  console.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (error) => {
  isDBConnected = false;
  console.error('MongoDB connection error:', error);
});

export const onConnected = (callback: () => void) => {
  if (isDBConnected || mongoose.connection.readyState === 1) {
    callback();
    return;
  }
  connectionCallbacks.push(callback);
};

export { mongoose };
