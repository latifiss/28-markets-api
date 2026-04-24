import request from 'supertest';
import { createApp } from '../../app';
const app = createApp();

describe('User API Endpoints', () => {
  it('responds on GET /', async () => {
    await request(app).get('/').expect(200);
  });
});