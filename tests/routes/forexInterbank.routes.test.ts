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
import ForexInterbank from '../../models/forexInterbank.model';

describe('Forex interbank routes', () => {
  it('updates interbank prices through the canonical path', async () => {
    const pair = await ForexInterbank.create({
      bankName: 'Test Bank',
      bankCode: 'TB',
      code: 'USDGHS_TB',
      name: 'USD/GHS (TB)',
      from_currency: 'US Dollar',
      from_code: 'USD',
      to_currency: 'Ghana Cedi',
      to_code: 'GHS',
      current_buying_price: 10,
      buying_percentage_change: 0,
      current_selling_price: 11,
      selling_percentage_change: 0,
      current_midrate_price: 10.5,
      midrate_percentage_change: 0,
      last_updated: new Date(),
    });

    const response = await request(createApp())
      .put(`/api/v1/forex/interbank-pairs/${pair._id}/prices`)
      .send({
        current_buying_price: 10.1,
        current_selling_price: 11.1,
        current_midrate_price: 10.6,
      })
      .expect(200);

    expect(response.body?.success).toBe(true);
    expect(response.body?.data?.bankCode).toBe('TB');
    expect(response.body?.data?.current_midrate_price).toBe(10.6);
  });
});
