const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const {
  createVoucher,
  listVouchers,
  toggleVoucher,
} = require('../controllers/voucherController');

router.post('/', verifyToken, isAdmin, createVoucher);
router.get('/', verifyToken, isAdmin, listVouchers);
router.patch('/:id/toggle', verifyToken, isAdmin, toggleVoucher);

module.exports = router;
