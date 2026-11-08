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
import { PriceHistory } from '../../models/stocks.model';

describe('Equities routes', () => {
  it('updates latest price through the canonical equity resource path', async () => {
    const doc = await (PriceHistory as any).create({
      company_id: 'cmp_1',
      company_name: 'Test Co',
      ticker_symbol: 'TST',
      history: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await request(createApp())
      .put(`/api/v1/equities/price-history/${doc.company_id}/latest`)
      .send({ price: '12.34' })
      .expect(200);

    expect(response.body?.success).toBe(true);
    expect(response.body?.data?.company_id).toBe('cmp_1');
    expect(response.body?.data?.latestPrice?.price).toBe('12.34');
  });
});
