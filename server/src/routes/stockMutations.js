import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { wrap, AppError } from '../utils/helpers.js';
import { buildMutationsWorkbook, workbookBuffer } from '../utils/excel.js';

const router = Router();
router.use(authenticate, requireRole('admin'));

function buildQuery(req) {
  const { product_id, date_from, date_to } = req.query;
  let sql = `
    SELECT sm.id, sm.product_id, p.sku, p.name AS product_name,
           sm.reference_type, sm.reference_id, sm.qty_change, sm.stock_after,
           sm.description, sm.created_at
    FROM stock_mutations sm JOIN products p ON p.id = sm.product_id
    WHERE 1=1`;
  const params = [];
  if (product_id) {
    sql += ' AND sm.product_id = ?';
    params.push(Number(product_id));
  }
  if (date_from) {
    sql += ' AND DATE(sm.created_at) >= ?';
    params.push(date_from);
  }
  if (date_to) {
    sql += ' AND DATE(sm.created_at) <= ?';
    params.push(date_to);
  }
  sql += ' ORDER BY sm.id DESC';
  return { sql, params };
}

router.get('/', wrap(async (req, res) => {
  const { sql, params } = buildQuery(req);
  const [rows] = await pool.query(sql, params);
  res.json(rows);
}));

router.delete('/:id', wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT reference_type FROM stock_mutations WHERE id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) throw new AppError(404, 'Mutasi tidak ditemukan');
  if (['sale', 'purchase'].includes(rows[0].reference_type)) {
    throw new AppError(400, 'Mutasi transaksi dihapus lewat hapus transaksinya');
  }
  await pool.query('DELETE FROM stock_mutations WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

router.get('/export', wrap(async (req, res) => {
  const { sql, params } = buildQuery(req);
  const [rows] = await pool.query(sql, params);
  const wb = await buildMutationsWorkbook(rows);
  const buffer = await workbookBuffer(wb);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="mutasi-stok.xlsx"');
  res.send(Buffer.from(buffer));
}));

export default router;
