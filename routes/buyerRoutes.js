const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { getMyBuyerProfile, upsertMyBuyerProfile } = require('../controllers/buyerController');

// Lihat profil buyer milik user yang login
router.get('/me', verifyToken, getMyBuyerProfile);

// Update/isi profil buyer milik user yang login
router.put('/me', verifyToken, upsertMyBuyerProfile);
router.patch('/me', verifyToken, upsertMyBuyerProfile);

module.exports = router;
