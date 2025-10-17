const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const {
  upsertRating,
  listProductRatings,
  getMyRatingForProduct,
} = require('../controllers/ratingController');

// User kasih/ubah rating untuk sebuah produk
router.post('/:productId', verifyToken, upsertRating);
router.put('/:productId', verifyToken, upsertRating);
router.patch('/:productId', verifyToken, upsertRating);

// List semua rating untuk produk (public/user login)
router.get('/product/:productId', verifyToken, listProductRatings);

// Ambil rating milik user sendiri untuk produk
router.get('/me/:productId', verifyToken, getMyRatingForProduct);

module.exports = router;
