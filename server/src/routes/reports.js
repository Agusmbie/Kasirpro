import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { wrap } from '../utils/helpers.js';

const router = Router();
router.use(authenticate, requireRole('admin'));

// period: 'daily' | 'weekly' | 'monthly'
function periodExpr(period) {
  if (period === 'weekly') {
    return "DATE_FORMAT(DATE_SUB(transaction_date, INTERVAL WEEKDAY(transaction_date) DAY), '%Y-%m-%d')";
  }
  if (period === 'monthly') {
    return "DATE_FORMAT(transaction_date, '%Y-%m')";
  }
  return "DATE_FORMAT(transaction_date, '%Y-%m-%d')";
}

function periodWhere(period, req) {
  const { date_from, date_to } = req.query;
  let where = ' WHERE 1=1';
  const params = [];
  if (date_from) { where += ' AND DATE(transaction_date) >= ?'; params.push(date_from); }
  if (date_to) { where += ' AND DATE(transaction_date) <= ?'; params.push(date_to); }
  return { where, params };
}

async function buildSummary(period, req) {
  const expr = periodExpr(period);
  const { where, params } = periodWhere(period, req);
  const [main] = await pool.query(
    `SELECT ${expr} AS period, COUNT(*) AS transaction_count, COALESCE(SUM(grand_total), 0) AS total
     FROM sales ${where} GROUP BY ${expr} ORDER BY period DESC`,
    params
  );
  const [items] = await pool.query(
    `SELECT ${expr.replace('transaction_date', 's.transaction_date')} AS period,
            SUM(si.qty) AS item_count,
            COALESCE(SUM(si.purchase_price * si.qty), 0) AS cost_total,
            COALESCE(SUM(si.list_price * si.qty), 0) AS revenue_total,
            COALESCE(SUM((si.list_price - si.purchase_price) * si.qty), 0) AS profit_total
     FROM sale_items si JOIN sales s ON s.id = si.sale_id ${where} GROUP BY period ORDER BY period DESC`,
    params
  );
  const byPeriod = new Map(items.map((r) => [r.period, r]));
  return main.map((r) => {
    const it = byPeriod.get(r.period) || { item_count: 0, cost_total: 0, revenue_total: 0, profit_total: 0 };
    return {
      period: r.period,
      transaction_count: Number(r.transaction_count),
      item_count: Number(it.item_count),
      total: Number(r.total),
      cost_total: Number(it.cost_total),
      revenue_total: Number(it.revenue_total),
      profit_total: Number(it.profit_total),
    };
  });
}

async function periodTotals(where, params) {
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(si.qty),0) AS item_count,
            COALESCE(SUM(si.purchase_price * si.qty),0) AS cost_total,
            COALESCE(SUM(si.list_price * si.qty),0) AS revenue_total,
            COALESCE(SUM((si.list_price - si.purchase_price) * si.qty),0) AS profit_total,
            COALESCE(SUM(s.grand_total),0) AS total
     FROM sale_items si JOIN sales s ON s.id = si.sale_id ${where}`,
    params
  );
  const r = rows[0] || {};
  return {
    item_count: Number(r.item_count || 0),
    cost_total: Number(r.cost_total || 0),
    revenue_total: Number(r.revenue_total || 0),
    profit_total: Number(r.profit_total || 0),
    total: Number(r.total || 0),
  };
}

async function periodSales(where, params) {
  const [rows] = await pool.query(
    `SELECT s.id, s.invoice_no, s.customer_name, s.transaction_date, s.grand_total, u.name AS user_name
     FROM sales s LEFT JOIN users u ON u.id = s.user_id ${where} ORDER BY s.id`,
    params
  );
  return rows;
}

router.get('/profit', wrap(async (req, res) => {
  const { product_id, date_from, date_to } = req.query;
  let where = ' WHERE 1=1';
  const params = [];
  if (product_id) { where += ' AND si.product_id = ?'; params.push(Number(product_id)); }
  if (date_from) { where += ' AND DATE(s.transaction_date) >= ?'; params.push(date_from); }
  if (date_to) { where += ' AND DATE(s.transaction_date) <= ?'; params.push(date_to); }

  const [rows] = await pool.query(
    `SELECT p.id, p.sku, p.name,
            SUM(si.qty) AS qty_sold,
            SUM(si.selling_price * si.qty) AS revenue,
            SUM(si.purchase_price * si.qty) AS cost,
            SUM((si.selling_price - si.purchase_price) * si.qty) AS profit
     FROM sale_items si
     JOIN products p ON p.id = si.product_id
     JOIN sales s ON s.id = si.sale_id
     ${where}
     GROUP BY p.id, p.sku, p.name
     ORDER BY profit DESC`,
    params
  );
  const [[totals]] = await pool.query(
    `SELECT COALESCE(SUM(si.qty),0) AS qty_sold,
            COALESCE(SUM(si.selling_price * si.qty),0) AS revenue,
            COALESCE(SUM(si.purchase_price * si.qty),0) AS cost,
            COALESCE(SUM((si.selling_price - si.purchase_price) * si.qty),0) AS profit
     FROM sale_items si JOIN sales s ON s.id = si.sale_id ${where}`,
    params
  );
  res.json({ items: rows, totals });
}));

router.get('/daily', wrap(async (req, res) => {
  res.json(await buildSummary('daily', req));
}));

router.get('/daily/:date', wrap(async (req, res) => {
  const where = ' WHERE DATE(s.transaction_date) = ?';
  const params = [req.params.date];
  const [sales, totals] = await Promise.all([periodSales(where, params), periodTotals(where, params)]);
  res.json({ sales, totals });
}));

router.get('/weekly', wrap(async (req, res) => {
  res.json(await buildSummary('weekly', req));
}));

router.get('/weekly/:start', wrap(async (req, res) => {
  const where = ' WHERE s.transaction_date >= ? AND s.transaction_date < DATE_ADD(?, INTERVAL 7 DAY)';
  const params = [req.params.start, req.params.start];
  const [sales, totals] = await Promise.all([periodSales(where, params), periodTotals(where, params)]);
  res.json({ sales, totals });
}));

router.get('/monthly', wrap(async (req, res) => {
  res.json(await buildSummary('monthly', req));
}));

router.get('/monthly/:month', wrap(async (req, res) => {
  const where = " WHERE DATE_FORMAT(s.transaction_date, '%Y-%m') = ?";
  const params = [req.params.month];
  const [sales, totals] = await Promise.all([periodSales(where, params), periodTotals(where, params)]);
  res.json({ sales, totals });
}));

export default router;
