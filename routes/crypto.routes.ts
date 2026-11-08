import express from 'express';
import {
  createCrypto,
  getAllCryptos,
  getCryptoBySymbol,
  getCryptoById,
  updateCryptoBySymbol,
  updateCryptoById,
  deleteCrypto,
  getCryptoHistory,
  addCryptoHistory,
  updateCryptoPrice,
  createCoinGainer,
  getAllCoinGainers,
  getCoinGainer,
  getTopGainers,
  getTopLosers,
  bulkUpdateCoinGainers,
  getComprehensiveData,
  createCoinLoser,
  getAllCoinLosers,
  getCoinLoser,
  updateCoinLoser,
  deleteCoinLoser,
  bulkUpdateCoinLosers,
  syncCoinLosers,
  createCoinHistory,
  getCoinHistory,
  getAllCoinHistories,
  deleteCoinHistory,
  getCoinHistoryStats,
  bulkUpsertCryptos,
} from '../controllers/crypto.controller';

const router = express.Router();

// Public routes
router.post('/', createCrypto);
router.put('/symbols/:symbol', updateCryptoBySymbol);
router.put('/ids/:id', updateCryptoById);
router.delete('/symbols/:symbol', deleteCrypto);
router.post('/:symbol/price', updateCryptoPrice);
router.post('/symbols/:symbol/history', addCryptoHistory);

router.get('/', getAllCryptos);
router.get('/symbols/:symbol', getCryptoBySymbol);
router.get('/ids/:id', getCryptoById);
router.get('/symbols/:symbol/history', getCryptoHistory);

router.post('/gainers', createCoinGainer);
router.post('/gainers/bulk', bulkUpdateCoinGainers);

router.get('/gainers', getAllCoinGainers);
router.get('/gainers/top', getTopGainers);
router.get('/gainers/losers', getTopLosers);
router.get('/gainers/:symbol', getCoinGainer);

router.post('/losers', createCoinLoser);
router.post('/losers/bulk', bulkUpdateCoinLosers);
router.post('/losers/sync', syncCoinLosers);

router.get('/losers', getAllCoinLosers);
router.get('/losers/top', getTopLosers);
router.get('/losers/:symbol', getCoinLoser);

router.put('/losers/:symbol', updateCoinLoser);
router.delete('/losers/:symbol', deleteCoinLoser);

router.post('/history', createCoinHistory);

router.get('/history', getAllCoinHistories);
router.get('/history/:symbol', getCoinHistory);
router.get('/history/:symbol/stats', getCoinHistoryStats);

router.delete('/history/:id', deleteCoinHistory);

router.get('/symbols/:symbol/overview', getComprehensiveData);

router.post('/bulk/upsert', bulkUpsertCryptos);


export default router;
