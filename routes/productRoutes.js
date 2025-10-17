// routes/productRoutes.js
const express = require('express');
const router = express.Router();
const {
  createProduct, getAllProducts, getProductById, updateProduct, deleteProduct,
} = require('../controllers/productController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// Admin
router.post('/', verifyToken, isAdmin, createProduct);
router.put('/:id', verifyToken, isAdmin, updateProduct);
router.delete('/:id', verifyToken, isAdmin, deleteProduct);

// User read
router.get('/', verifyToken, getAllProducts);
router.get('/:id', verifyToken, getProductById);

module.exports = router;
