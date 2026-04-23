import type { Request, Response } from 'express';
import { updateForexPrice } from '../../controllers/forex.controller';
import Forex from '../../models/forex.model';

jest.mock('../../lib/redis', () => ({
  getRedisClient: async () => null,
}));

const publishForexUpdate = jest.fn();
jest.mock('../../lib/realtime/ws', () => {
  const actual = jest.requireActual('../../lib/realtime/ws');
  return {
    ...actual,
    publishForexUpdate: (...args: any[]) => publishForexUpdate(...args),
  };
});

function mockRes() {
  const res: Partial<Response> = {};
  (res as any).status = jest.fn().mockReturnValue(res);
  (res as any).json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('Forex controller unit', () => {
  it('calls publishForexUpdate after successful updateForexPrice', async () => {
    await Forex.create({
      code: 'EURUSD',
      name: 'EUR/USD',
      from_currency: 'Euro',
      from_code: 'EUR',
      to_currency: 'US Dollar',
      to_code: 'USD',
      currentPrice: 1,
      percentage_change: 0,
      last_updated: new Date(),
    });

    const req = {
      params: { code: 'EURUSD' },
      body: { currentPrice: 1.1 },
    } as unknown as Request;

    const res = mockRes();
    await updateForexPrice(req, res);

    expect((res as any).status).toHaveBeenCalledWith(200);
    expect(publishForexUpdate).toHaveBeenCalled();
  });
});

