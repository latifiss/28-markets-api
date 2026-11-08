const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const validateEnvironment = (): void => {
  const mongoUri = required('MONGODB_URI');
  const jwtSecret = required('JWT_SECRET');

  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }

  if (!/^mongodb(?:\+srv)?:\/\//i.test(mongoUri)) {
    throw new Error('MONGODB_URI must be a valid MongoDB connection URI');
  }

  if (process.env.NODE_ENV === 'production') {
    const redisUrl = required('REDIS_URL');
    if (!/^rediss:\/\//i.test(redisUrl)) {
      throw new Error('Production REDIS_URL must use TLS (rediss://)');
    }
  }

  const port = Number(process.env.PORT || 6060);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
};
