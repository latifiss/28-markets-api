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
import { unifiedAuth } from '../middleware/unifiedAuth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Public routes
router.post('/', createCrypto);
router.put('/symbol/:symbol', updateCryptoBySymbol);
router.put('/id/:id', updateCryptoById);
router.delete('/:symbol', deleteCrypto);
router.post('/:symbol/price', updateCryptoPrice);
router.post('/:symbol/history', addCryptoHistory);

router.get('/', getAllCryptos);
router.get('/symbol/:symbol', getCryptoBySymbol);
router.get('/id/:id', getCryptoById);
router.get('/:symbol/history', getCryptoHistory);

router.post('/coingainers', createCoinGainer);
router.post('/coingainers/bulk', bulkUpdateCoinGainers);

router.get('/coingainers', getAllCoinGainers);
router.get('/coingainers/top', getTopGainers);
router.get('/coingainers/losers', getTopLosers);
router.get('/coingainers/:symbol', getCoinGainer);

router.post('/coinlosers', createCoinLoser);
router.post('/coinlosers/bulk', bulkUpdateCoinLosers);
router.post('/coinlosers/sync', syncCoinLosers);

router.get('/coinlosers', getAllCoinLosers);
router.get('/coinlosers/top', getTopLosers);
router.get('/coinlosers/:symbol', getCoinLoser);

router.put('/coinlosers/:symbol', updateCoinLoser);
router.delete('/coinlosers/:symbol', deleteCoinLoser);

router.post('/coin-history', createCoinHistory);

router.get('/coin-history', getAllCoinHistories);
router.get('/coin-history/:symbol', getCoinHistory);
router.get('/coin-history/:symbol/stats', getCoinHistoryStats);

router.delete('/coin-history/:id', deleteCoinHistory);

router.get('/:symbol/comprehensive', getComprehensiveData);

router.post('/crypto/bulk/upsert', bulkUpsertCryptos);


// Key protected routes
router.post('/coin/', unifiedAuth, rateLimiter, createCrypto);
router.put('/coin/symbol/:symbol', unifiedAuth, rateLimiter, updateCryptoBySymbol);
router.put('/coin/id/:id', unifiedAuth, rateLimiter, updateCryptoById);
router.delete('/coin/:symbol', unifiedAuth, rateLimiter, deleteCrypto);
router.post('/coin/:symbol/price', unifiedAuth, rateLimiter, updateCryptoPrice);
router.post('/coin/:symbol/history', unifiedAuth, rateLimiter, addCryptoHistory);

router.get('/coin/', unifiedAuth, rateLimiter, getAllCryptos);
router.get('/coin/symbol/:symbol', unifiedAuth, rateLimiter, getCryptoBySymbol);
router.get('/coin/id/:id', unifiedAuth, rateLimiter, getCryptoById);
router.get('/coin/:symbol/history', unifiedAuth, rateLimiter, getCryptoHistory);

router.post('/coin/coingainers', unifiedAuth, rateLimiter, createCoinGainer);
router.post('/coin/coingainers/bulk', unifiedAuth, rateLimiter, bulkUpdateCoinGainers);

router.get('/coin/coingainers', unifiedAuth, rateLimiter, getAllCoinGainers);
router.get('/coin/coingainers/top', unifiedAuth, rateLimiter, getTopGainers);
router.get('/coin/coingainers/losers', unifiedAuth, rateLimiter, getTopLosers);
router.get('/coin/coingainers/:symbol', unifiedAuth, rateLimiter, getCoinGainer);

router.post('/coin/coinlosers', unifiedAuth, rateLimiter, createCoinLoser);
router.post('/coin/coinlosers/bulk', unifiedAuth, rateLimiter, bulkUpdateCoinLosers);
router.post('/coin/coinlosers/sync', unifiedAuth, rateLimiter, syncCoinLosers);

router.get('/coin/coinlosers', unifiedAuth, rateLimiter, getAllCoinLosers);
router.get('/coin/coinlosers/top', unifiedAuth, rateLimiter, getTopLosers);
router.get('/coin/coinlosers/:symbol', unifiedAuth, rateLimiter, getCoinLoser);

router.put('/coin/coinlosers/:symbol', unifiedAuth, rateLimiter, updateCoinLoser);
router.delete('/coin/coinlosers/:symbol', unifiedAuth, rateLimiter, deleteCoinLoser);

router.post('/coin/coin-history', unifiedAuth, rateLimiter, createCoinHistory);

router.get('/coin/coin-history', unifiedAuth, rateLimiter, getAllCoinHistories);
router.get('/coin/coin-history/:symbol', unifiedAuth, rateLimiter, getCoinHistory);
router.get('/coin/coin-history/:symbol/stats', unifiedAuth, rateLimiter, getCoinHistoryStats);

router.delete('/coin/coin-history/:id', unifiedAuth, rateLimiter, deleteCoinHistory);

router.get('/coin/:symbol/comprehensive', unifiedAuth, rateLimiter, getComprehensiveData);

router.post('/coin/crypto/bulk/upsert', unifiedAuth, rateLimiter, bulkUpsertCryptos);

export default router;