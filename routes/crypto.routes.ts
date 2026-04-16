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
} from '../controllers/crypto.controller';

const router = express.Router();

router.post('/crypto', createCrypto);
router.put('/crypto/symbol/:symbol', updateCryptoBySymbol);
router.put('/crypto/id/:id', updateCryptoById);
router.delete('/crypto/:symbol', deleteCrypto);
router.post('/crypto/:symbol/price', updateCryptoPrice);
router.post('/crypto/:symbol/history', addCryptoHistory);

router.get('/crypto', getAllCryptos);
router.get('/crypto/symbol/:symbol', getCryptoBySymbol);
router.get('/crypto/id/:id', getCryptoById);
router.get('/crypto/:symbol/history', getCryptoHistory);

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

router.get('/crypto/:symbol/comprehensive', getComprehensiveData);

export default router;