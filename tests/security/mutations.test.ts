import request from 'supertest';
jest.mock('../../lib/redis', () => ({
  getRedisClient: async () => ({
    eval: async (_script: string, options: { keys: string[] }) =>
      options.keys[0].includes(':auth-rl:') ? [1, 9, 0] : [1, 500, 0],
    get: async () => null,
    set: async () => 'OK',
    del: async () => 1,
    rPush: async () => 1,
  }),
}));

import { createApp } from '../../app';

describe('market data mutation security', () => {
  it.each([
    ['/api/v1/forex/pairs', 'post'],
    ['/api/v1/crypto', 'post'],
    ['/api/v1/commodities', 'post'],
    ['/api/v1/economic-indicators/interest-rate', 'post'],
    ['/api/v1/treasury/bonds', 'post'],
    ['/api/v1/equities/profiles', 'post'],
    ['/api/v1/gold/prices', 'post'],
    ['/api/v1/forex/interbank-pairs', 'post'],
    ['/api/v1/indices', 'post'],
    ['/api/v1/events', 'post'],
  ])('%s rejects anonymous mutation requests', async (path, method) => {
    const response = await (request(createApp()) as any)[method](path).send({});
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('AUTHENTICATION_REQUIRED');
  });
});
