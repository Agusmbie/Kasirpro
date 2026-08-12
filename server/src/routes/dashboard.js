import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { wrap, formatLocalDate } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

router.get('/', wrap(async (req, res) => {
  const today = formatLocalDate();
  const [[rev]] = await pool.query(
    'SELECT COALESCE(SUM(grand_total), 0) AS total FROM sales WHERE DATE(transaction_date) = ?',
    [today]
  );
  const [[cnt]] = await pool.query(
    'SELECT COUNT(*) AS total FROM sales WHERE DATE(transaction_date) = ?',
    [today]
  );
  const [[profit]] = await pool.query(
    `SELECT COALESCE(SUM((si.selling_price - si.purchase_price) * si.qty), 0) AS total
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE DATE(s.transaction_date) = ?`,
    [today]
  );
  const [lowStock] = await pool.query(
    `SELECT id, sku, name, current_stock, min_stock_hint FROM (
       SELECT id, sku, name, current_stock, 10 AS min_stock_hint
       FROM products WHERE deleted_at IS NULL AND current_stock < 10
       ORDER BY current_stock ASC LIMIT 10
     ) t`
  );
  const [[prodCount]] = await pool.query(
    'SELECT COUNT(*) AS total FROM products WHERE deleted_at IS NULL'
  );
  res.json({
    todayRevenue: Number(rev.total),
    todayTransactions: Number(cnt.total),
    todayProfit: Number(profit.total),
    lowStockProducts: lowStock,
    totalProducts: Number(prodCount.total),
  });
}));

export default router;
