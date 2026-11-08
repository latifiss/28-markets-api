import request from 'supertest';
jest.mock('../../middleware/protectMutations', () => ({
  protectMutations: (_req: any, _res: any, next: any) => next(),
}));
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

describe('Crypto routes', () => {
  it('exposes the versioned public crypto collection endpoint', async () => {
    const response = await request(createApp()).get('/api/v1/crypto');
    expect(response.status).not.toBe(404);
  });
});
