import request from 'supertest';
import { createApp } from '../../app';
import { PriceHistory } from '../../models/stocks.model';

jest.mock('../../lib/redis', () => ({
  getRedisClient: async () => null,
}));

describe('Stocks routes', () => {
  it('updates latest price and returns 200', async () => {
    const app = createApp();
    const doc = await (PriceHistory as any).create({
      company_id: 'cmp_1',
      company_name: 'Test Co',
      ticker_symbol: 'TST',
      history: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .put(`/api/stocks/equity/price-history/${doc.company_id}/latest`)
      .send({ price: '12.34' })
      .expect(200);

    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.company_id).toBe('cmp_1');
    expect(res.body?.data?.latestPrice?.price).toBe('12.34');
  });
});

