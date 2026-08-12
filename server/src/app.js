import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import categoryRoutes from './routes/categories.js';
import supplierRoutes from './routes/suppliers.js';
import typeRoutes from './routes/types.js';
import modelRoutes from './routes/models.js';
import productRoutes from './routes/products.js';
import purchaseOrderRoutes from './routes/purchaseOrders.js';
import saleRoutes from './routes/sales.js';
import stockMutationRoutes from './routes/stockMutations.js';
import dashboardRoutes from './routes/dashboard.js';
import reportRoutes from './routes/reports.js';

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/types', typeRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/products', productRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/stock-mutations', stockMutationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route tidak ditemukan' }));

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Terjadi kesalahan server' : err.message });
});

export default app;
