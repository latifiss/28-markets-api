import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import http from 'http';
import { connectDB } from './db/index';
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
import { initRealtimeWebsocketServer } from './lib/realtime/ws';

connectDB();

const app = express();
app.use(cors());
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

const allowedOrigins = [
  'http://localhost:4000',
  'http://localhost:3000',
  'http://localhost:3001',
];

const server = http.createServer(app);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));
app.use(
  cors({
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

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

app.get('/', (req, res) => {
  res.send('Hello World!');
});

const PORT = process.env.PORT || 6060;

mongoose.connect(process.env.MONGODB_URI!)
  .then(() => {
    console.log('Connected to MongoDB');
    initRealtimeWebsocketServer(server, {
      path: process.env.WS_PATH || '/ws',
      allowedOrigins,
    });

    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error(err));