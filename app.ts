import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';

import authRouter from './routes/auth';
import usageRouter from './routes/usage';
import cryptoRoutes from './routes/crypto.routes';
import indexRoutes from './routes/index.routes';
import forexRoutes from './routes/forex.routes';
import forexInterbankRoutes from './routes/forexInterbank.routes';
import commodityRoutes from './routes/commodity.routes';
import goldbodRoutes from './routes/goldbod.routes';
import economicRoutes from './routes/economic.routes';
import treasuryRoutes from './routes/treasury.routes';
import stockRoutes from './routes/stocks.routes';
import eventRoutes from './routes/event.routes';
import billingRouter from './routes/billing';
import { protectMutations } from './middleware/protectMutations';
import { publicResponseCache } from './middleware/publicResponseCache';

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

  // Render terminates TLS and forwards requests through one trusted proxy.
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Origin is not allowed by CORS'));
      },
      credentials: true,
      maxAge: 86400,
    }),
  );

  // Webhook signatures must be checked against the unparsed request body.
  app.use('/api/billing/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.get('/health/live', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/health/ready', (_req, res) => {
    const databaseReady = mongoose.connection.readyState === 1;
    res.status(databaseReady ? 200 : 503).json({
      status: databaseReady ? 'ready' : 'not_ready',
      dependencies: { mongodb: databaseReady ? 'connected' : 'disconnected' },
    });
  });

  app.use('/api', publicResponseCache);

  for (const prefix of ['/api/crypto', '/api/index', '/api/forex', '/api/forex-interbank-rates', '/api/commodity', '/api/goldbod', '/api/economy', '/api/treasury', '/api/stocks', '/api/event']) {
    app.use(prefix, protectMutations);
  }

  app.use('/api/auth', authRouter);
  app.use('/api/usage', usageRouter);
  app.use('/api/crypto', cryptoRoutes);
  app.use('/api/index', indexRoutes);
  app.use('/api/forex', forexRoutes);
  app.use('/api/forex-interbank-rates', forexInterbankRoutes);
  app.use('/api/commodity', commodityRoutes);
  app.use('/api/goldbod', goldbodRoutes);
  app.use('/api/economy', economicRoutes);
  app.use('/api/treasury', treasuryRoutes);
  app.use('/api/stocks', stockRoutes);
  app.use('/api/event', eventRoutes);
  app.use('/api/billing', billingRouter);

  app.get('/', (_req, res) => {
    res.json({ name: '28 Markets API', status: 'operational' });
  });

  // Keep error responses predictable and avoid leaking internal exception details.
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);

    const status =
      err?.type === 'entity.too.large' ? 413 :
      err instanceof SyntaxError && 'body' in err ? 400 :
      err?.message === 'Origin is not allowed by CORS' ? 403 : 500;

    if (status === 500) {
      console.error('Unhandled request error:', err);
    }

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
