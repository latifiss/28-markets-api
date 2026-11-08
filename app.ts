import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';

import v1Routes from './routes/v1';
import { protectMutations } from './middleware/protectMutations';
import { optionalApiIdentity } from './middleware/optionalApiIdentity';
import { apiIpRateLimit, apiRateLimit } from './middleware/rateLimit';
import { publicResponseCache } from './middleware/publicResponseCache';
import { getRedisClient } from './lib/redis';

const defaultAllowedOrigins = [
  'http://localhost:4000',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://28-markets.vercel.app',
  'https://28-markets.com',
  'https://www.28-markets.com',
];

export const allowedOrigins = Array.from(
  new Set([
    ...defaultAllowedOrigins,
    ...(process.env.CORS_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  ]),
);

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));

  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true,
    maxAge: 86400,
  }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.get('/health/live', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/health/ready', async (_req, res) => {
    const databaseReady = mongoose.connection.readyState === 1;
    const redis = await getRedisClient();
    const redisReady = Boolean(redis?.isReady);
    const ready = databaseReady && redisReady;

    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      dependencies: {
        mongodb: databaseReady ? 'connected' : 'disconnected',
        redis: redisReady ? 'connected' : 'disconnected',
      },
    });
  });

  // IP guard runs before credentials are parsed; identity limits run after optional auth.
  app.use('/api/v1', apiIpRateLimit, optionalApiIdentity, apiRateLimit, publicResponseCache);

  const mutationPrefixes = [
    '/api/v1/crypto',
    '/api/v1/indices',
    '/api/v1/forex',
    '/api/v1/commodities',
    '/api/v1/gold',
    '/api/v1/economic-indicators',
    '/api/v1/treasury',
    '/api/v1/equities',
    '/api/v1/events',
  ];
  for (const prefix of mutationPrefixes) {
    app.use(prefix, protectMutations);
  }

  app.use('/api/v1', v1Routes);

  app.get('/', (_req, res) => {
    res.json({
      name: '28 Markets API',
      status: 'operational',
      apiVersion: 'v1',
      apiBasePath: '/api/v1',
    });
  });

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);

    const status =
      err?.type === 'entity.too.large' ? 413 :
      err instanceof SyntaxError && 'body' in err ? 400 :
      err?.message === 'Origin is not allowed by CORS' ? 403 : 500;

    if (status === 500) console.error('Unhandled request error:', err);

    return res.status(status).json({
      error:
        status === 413 ? 'Request body too large' :
        status === 400 ? 'Invalid JSON request body' :
        status === 403 ? 'Origin is not allowed' :
        'Internal server error',
    });
  });

  return app;
}
