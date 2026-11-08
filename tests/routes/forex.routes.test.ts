import request from 'supertest';
import { createApp } from '../../app';

jest.mock('../../lib/redis', () => ({
  getRedisClient: async () => null,
}));

describe('Forex routes', () => {
  it('requires authentication for forex mutations', async () => {
    const app = createApp();

    await request(app)
      .post('/api/forex')
      .send({ currentPrice: 10.5 })
      .expect(401);
  });
});
