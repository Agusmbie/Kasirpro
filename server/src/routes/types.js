import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { wrap, AppError } from '../utils/helpers.js';

const router = Router();

router.get('/', authenticate, wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM types ORDER BY name');
  res.json(rows);
}));

router.post('/', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const { name, purchase_price, selling_price } = req.body || {};
  if (!name) throw new AppError(400, 'Nama type wajib diisi');
  try {
    const [r] = await pool.query(
      'INSERT INTO types (name, purchase_price, selling_price) VALUES (?, ?, ?)',
      [name, Number(purchase_price || 0), Number(selling_price || 0)]
    );
    res.status(201).json({ id: r.insertId, name, purchase_price: Number(purchase_price || 0), selling_price: Number(selling_price || 0) });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new AppError(409, 'Type sudah ada');
    throw e;
  }
}));

router.put('/:id', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const { name, purchase_price, selling_price } = req.body || {};
  if (!name) throw new AppError(400, 'Nama type wajib diisi');
  const [r] = await pool.query(
    'UPDATE types SET name = ?, purchase_price = ?, selling_price = ? WHERE id = ?',
    [name, Number(purchase_price || 0), Number(selling_price || 0), req.params.id]
  );
  if (r.affectedRows === 0) throw new AppError(404, 'Type tidak ditemukan');
  res.json({ id: Number(req.params.id), name, purchase_price: Number(purchase_price || 0), selling_price: Number(selling_price || 0) });
}));

router.delete('/:id', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const [r] = await pool.query('DELETE FROM types WHERE id = ?', [req.params.id]);
  if (r.affectedRows === 0) throw new AppError(404, 'Type tidak ditemukan');
  res.json({ ok: true });
}));

export default router;
