import request from 'supertest';
import { createApp } from '../../app';
import Forex from '../../models/forex.model';

jest.mock('../../lib/redis', () => ({
  getRedisClient: async () => null,
}));

describe('Forex routes', () => {
  it('updates forex price and returns 200', async () => {
    const app = createApp();
    await Forex.create({
      code: 'USDGHS',
      name: 'USD/GHS',
      from_currency: 'US Dollar',
      from_code: 'USD',
      to_currency: 'Ghana Cedi',
      to_code: 'GHS',
      currentPrice: 10,
      percentage_change: 0,
      last_updated: new Date(),
    });

    const res = await request(app)
      .post('/api/forex/USDGHS/price')
      .send({ currentPrice: 10.5 })
      .expect(200);

    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.code).toBe('USDGHS');
    expect(res.body?.data?.currentPrice).toBe(10.5);
  });
});

