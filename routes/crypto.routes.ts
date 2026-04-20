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

export default router;