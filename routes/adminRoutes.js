const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const { promoteToAdmin } = require('../controllers/adminController');

router.patch('/users/:id/promote', verifyToken, isAdmin, promoteToAdmin);

module.exports = router;
