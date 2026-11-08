import 'dotenv/config';
import http from 'http';
import path from 'path';
import express from 'express';
import mongoose from 'mongoose';
import { connectDB } from './db';
import { initRealtimeWebsocketServer } from './lib/realtime/ws';
import { closeRedisClient } from './lib/redis';
import { validateEnvironment } from './config/env';
import { createApp, allowedOrigins } from './app';

export const app = createApp();
export const server = http.createServer(app);

const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

app.get('/favicon.ico', (_req, res) => {
  res.sendFile(path.join(publicPath, 'favicon.ico'));
});

const PORT = Number(process.env.PORT || 6060);

export async function start() {
  validateEnvironment();
  await connectDB();

  initRealtimeWebsocketServer(server, {
    path: process.env.WS_PATH || '/ws',
    allowedOrigins,
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once('error', onError);
    server.listen(PORT, '0.0.0.0', () => {
      server.off('error', onError);
      resolve();
    });
  });

  console.info(`28 Markets API listening on port ${PORT}`);
}

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Received ${signal}; shutting down gracefully`);

  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  try {
    await new Promise<void>((resolve, reject) => {
      if (!server.listening) return resolve();
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await Promise.allSettled([mongoose.disconnect(), closeRedisClient()]);
    clearTimeout(forceExit);
    process.exitCode = 0;
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
  start().catch((error) => {
    console.error('Application startup failed:', error);
    process.exitCode = 1;
  });
}
