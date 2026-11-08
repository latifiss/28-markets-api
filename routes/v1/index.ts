import express from 'express';
import authRoutes from '../auth';
import usageRoutes from '../usage';
import cryptoRoutes from '../crypto.routes';
import indexRoutes from '../index.routes';
import forexRoutes from '../forex.routes';
import forexInterbankRoutes from '../forexInterbank.routes';
import commodityRoutes from '../commodity.routes';
import goldbodRoutes from '../goldbod.routes';
import economicRoutes from '../economic.routes';
import treasuryRoutes from '../treasury.routes';
import stockRoutes from '../stocks.routes';
import eventRoutes from '../event.routes';

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({
    name: '28 Markets API',
    version: '1',
    resources: [
      '/api/v1/crypto',
      '/api/v1/indices',
      '/api/v1/forex/pairs',
      '/api/v1/forex/interbank-pairs',
      '/api/v1/commodities',
      '/api/v1/gold/prices',
      '/api/v1/economic-indicators',
      '/api/v1/treasury/bonds',
      '/api/v1/equities',
      '/api/v1/events',
    ],
  });
});

router.use('/auth', authRoutes);
router.use('/account/usage', usageRoutes);
router.use('/crypto', cryptoRoutes);
router.use('/indices', indexRoutes);
router.use('/forex/pairs', forexRoutes);
router.use('/forex/interbank-pairs', forexInterbankRoutes);
router.use('/commodities', commodityRoutes);
router.use('/gold/prices', goldbodRoutes);
router.use('/economic-indicators', economicRoutes);
router.use('/treasury/bonds', treasuryRoutes);
router.use('/equities', stockRoutes);
router.use('/events', eventRoutes);

export default router;
