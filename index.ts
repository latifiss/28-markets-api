import 'dotenv/config';
import mongoose from 'mongoose';
import http from 'http';
import { connectDB } from './db/index';
import { initRealtimeWebsocketServer } from './lib/realtime/ws';
import { createApp, allowedOrigins } from './app';

export const app = createApp();
export const server = http.createServer(app);

const PORT = process.env.PORT || 6060;

export async function start() {
  // Optional extra connection management/logging (kept for prod runs)
  connectDB();

  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');
  initRealtimeWebsocketServer(server, {
    path: process.env.WS_PATH || '/ws',
    allowedOrigins,
  });
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// Only auto-start when running the file directly (not when imported by Jest).
if (require.main === module) {
  start().catch((err) => console.error(err));
}