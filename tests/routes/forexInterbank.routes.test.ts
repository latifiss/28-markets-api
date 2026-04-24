import request from 'supertest';
import { createApp } from '../../app';
import ForexInterbank from '../../models/forexInterbank.model';

jest.mock('../../lib/redis', () => ({
  getRedisClient: async () => null,
}));

describe('Forex interbank routes', () => {
  it('updates interbank prices and returns 200', async () => {
    const app = createApp();
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

    const res = await request(app)
      .put(`/api/forex-interbank-rates/interbank-pairs/${pair._id}/prices`)
      .send({
        current_buying_price: 10.1,
        current_selling_price: 11.1,
        current_midrate_price: 10.6,
      })
      .expect(200);

    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.bankCode).toBe('TB');
    expect(res.body?.data?.current_midrate_price).toBe(10.6);
  });
});

