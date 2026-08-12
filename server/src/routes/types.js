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
  const { name } = req.body || {};
  if (!name) throw new AppError(400, 'Nama type wajib diisi');
  try {
    const [r] = await pool.query('INSERT INTO types (name) VALUES (?)', [name]);
    res.status(201).json({ id: r.insertId, name });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new AppError(409, 'Type sudah ada');
    throw e;
  }
}));

router.delete('/:id', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const [r] = await pool.query('DELETE FROM types WHERE id = ?', [req.params.id]);
  if (r.affectedRows === 0) throw new AppError(404, 'Type tidak ditemukan');
  res.json({ ok: true });
}));

export default router;
