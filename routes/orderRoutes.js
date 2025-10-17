const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const {
  createOrder,
  getMyOrders,
  getOrderById,
  adminListOrders,
  adminUpdateStatus,
} = require('../controllers/orderController');

// USER
router.post('/', verifyToken, createOrder);
router.get('/', verifyToken, getMyOrders);
router.get('/:id', verifyToken, getOrderById);

// ADMIN
router.get('/admin/list', verifyToken, isAdmin, adminListOrders);
router.patch('/:id/status', verifyToken, isAdmin, adminUpdateStatus);

module.exports = router;
