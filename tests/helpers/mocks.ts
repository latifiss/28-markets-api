export function mockRedis() {
  jest.mock('../../lib/redis', () => ({
    getRedisClient: async () => null,
  }));
}

