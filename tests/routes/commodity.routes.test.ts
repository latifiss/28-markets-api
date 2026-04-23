import request from 'supertest';
import { createApp } from '../../app';
import Commodity from '../../models/commodity.model';

jest.mock('../../lib/redis', () => ({
  getRedisClient: async () => null,
}));

describe('Commodity routes', () => {
  it('updates commodity price and returns 200', async () => {
    const app = createApp();
    await Commodity.create({
      code: 'GOLD',
      name: 'Gold',
      unit: 'oz',
      category: 'metals',
      currentPrice: 100,
      percentage_change: 0,
      last_updated: new Date(),
    });

    const res = await request(app)
      .post('/api/commodity/commodities/GOLD/price')
      .send({ currentPrice: 110 })
      .expect(200);

    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.code).toBe('GOLD');
    expect(res.body?.data?.currentPrice).toBe(110);
  });
});

