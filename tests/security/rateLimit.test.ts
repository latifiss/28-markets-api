import express from 'express';
import request from 'supertest';

jest.mock('../../lib/redis', () => ({
  getRedisClient: async () => ({
    eval: async (_script: string, options: { keys: string[] }) =>
      options.keys[0].includes(':ip:')
        ? [0, 0, 1500]
        : [1, 100, 0],
  }),
}));

import { apiIpRateLimit, apiRateLimit } from '../../middleware/rateLimit';

describe('distributed API rate limiting', () => {
  it('rejects excess IP traffic before identity authentication', async () => {
    const app = express();
    app.use(apiIpRateLimit, apiRateLimit);
    app.get('/resource', (_req, res) => res.json({ ok: true }));

    const response = await request(app).get('/resource').expect(429);
    expect(response.body.code).toBe('IP_RATE_LIMIT_EXCEEDED');
    expect(response.headers['retry-after']).toBeDefined();
    expect(response.headers['ratelimit-limit']).toBeDefined();
  });
});
