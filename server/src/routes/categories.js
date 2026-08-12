import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { wrap, AppError } from '../utils/helpers.js';

const router = Router();

router.get('/', authenticate, wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM categories ORDER BY name');
  res.json(rows);
}));

router.post('/', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const { name } = req.body || {};
  if (!name) throw new AppError(400, 'Nama kategori wajib diisi');
  const [r] = await pool.query('INSERT INTO categories (name) VALUES (?)', [name]);
  res.status(201).json({ id: r.insertId, name });
}));

router.put('/:id', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const { name } = req.body || {};
  if (!name) throw new AppError(400, 'Nama kategori wajib diisi');
  await pool.query('UPDATE categories SET name = ? WHERE id = ?', [name, req.params.id]);
  res.json({ ok: true });
}));

router.delete('/:id', authenticate, requireRole('admin'), wrap(async (req, res) => {
  await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

export default router;
