const express = require('express');
const app = express();
require('dotenv').config();

const PORT = process.env.PORT || 3000;

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const buyerRoutes = require('./routes/buyerRoutes');
const orderRoutes = require('./routes/orderRoutes');     
const voucherRoutes = require('./routes/voucherRoutes');  
const ratingRoutes = require('./routes/ratingRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/buyer', buyerRoutes);
app.use('/orders', orderRoutes);      
app.use('/vouchers', voucherRoutes);  
app.use('/ratings', ratingRoutes);
app.use('/admin', adminRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
