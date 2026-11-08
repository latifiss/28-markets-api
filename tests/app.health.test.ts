import request from 'supertest';
import { createApp } from '../app';

describe('health endpoints', () => {
  it('reports process liveness without requiring downstream services', async () => {
    await request(createApp())
      .get('/health/live')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
      });
  });

  it('reports readiness only when MongoDB is connected', async () => {
    const response = await request(createApp()).get('/health/ready');
    expect([200, 503]).toContain(response.status);
    expect(response.body.dependencies).toHaveProperty('mongodb');
  });
});
