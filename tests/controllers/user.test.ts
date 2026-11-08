import request from 'supertest';
import { createApp } from '../../app';
import { generateToken } from '../../middleware/auth';
const app = createApp();

describe('User API Endpoints', () => {
  it('requires credentials for the root API information endpoint', async () => {
    await request(app).get('/').expect(401);
  });

  it('responds to authenticated requests on GET /', async () => {
    const token = generateToken({ userId: '64b000000000000000000014', email: 'reader@example.com', role: 'user' });
    await request(app).get('/').set('Authorization', `Bearer ${token}`).expect(200);
  });
});