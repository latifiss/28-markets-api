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

describe('Forex routes', () => {
  it('requires administrator authentication for forex mutations', async () => {
    await request(createApp())
      .post('/api/v1/forex/pairs')
      .send({ currentPrice: 10.5 })
      .expect(401);
  });
});
