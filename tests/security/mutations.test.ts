import request from 'supertest';
import {createApp} from '../../app';
jest.mock('../../lib/redis',()=>({getRedisClient:async()=>null}));
describe('market data mutation security',()=>{
 it.each([
  ['/api/forex','post'],
  ['/api/crypto','post'],
  ['/api/commodity/commodities','post'],
  ['/api/economy/interest-rate','post'],
  ['/api/treasury/treasury','post'],
  ['/api/stocks/equity/profiles','post'],
  ['/api/goldbod','post'],
  ['/api/forex-interbank-rates/interbank-pairs','post'],
  ['/api/index/indices','post'],
  ['/api/event','post'],
 ])('%s rejects anonymous mutation requests',async(path,method)=>{
  const response=await (request(createApp()) as any)[method](path).send({});
  expect(response.status).toBe(401);
 });
});
