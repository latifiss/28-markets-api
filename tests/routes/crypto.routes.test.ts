import request from 'supertest';
import { createApp } from '../../app';
import { Crypto } from '../../models/crypto.model';

jest.mock('../../lib/redis', () => ({
  getRedisClient: async () => null,
}));

describe('Crypto routes', () => {
  it('updates crypto price (requires API key)', async () => {
    const app = createApp();
    process.env.API_KEY = 'test-key';

    await (Crypto as any).create({
      id: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      current_price: 100,
      market_cap_rank: 1,
      price_history: [],
      last_updated: new Date(),
    });

    const res = await request(app)
      .post('/api/crypto/BTC/price')
      .set('x-api-key', 'test-key')
      .send({ current_price: 110 })
      .expect(200);

    expect(res.body?.success).toBe(true);
    expect(String(res.body?.data?.symbol).toUpperCase()).toBe('BTC');
    expect(res.body?.data?.current_price).toBe(110);
  });
});

