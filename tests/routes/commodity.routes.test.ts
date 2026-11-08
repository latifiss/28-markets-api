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
import { generateToken } from '../../middleware/auth';
import Commodity from '../../models/commodity.model';

describe('Commodity routes', () => {
  it('updates a commodity through the canonical resource path', async () => {
    await Commodity.create({
      code: 'GOLD',
      name: 'Gold',
      unit: 'oz',
      category: 'metals',
      currentPrice: 100,
      percentage_change: 0,
      last_updated: new Date(),
    });

    const token = generateToken({ userId: '64b000000000000000000013', email: 'admin@example.com', role: 'admin' });
    const response = await request(createApp())
      .post('/api/v1/commodities/GOLD/price')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPrice: 110 })
      .expect(200);

    expect(response.body?.success).toBe(true);
    expect(response.body?.data?.code).toBe('GOLD');
    expect(response.body?.data?.currentPrice).toBe(110);
  });
});
