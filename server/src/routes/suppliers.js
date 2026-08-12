import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { wrap, AppError } from '../utils/helpers.js';

const router = Router();

router.get('/', authenticate, wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM suppliers ORDER BY name');
  res.json(rows);
}));

router.post('/', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const { name, phone, address } = req.body || {};
  if (!name) throw new AppError(400, 'Nama supplier wajib diisi');
  const [r] = await pool.query('INSERT INTO suppliers (name, phone, address) VALUES (?,?,?)', [name, phone || null, address || null]);
  res.status(201).json({ id: r.insertId, name, phone, address });
}));

router.put('/:id', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const { name, phone, address } = req.body || {};
  if (!name) throw new AppError(400, 'Nama supplier wajib diisi');
  await pool.query('UPDATE suppliers SET name=?, phone=?, address=? WHERE id=?', [name, phone || null, address || null, req.params.id]);
  res.json({ ok: true });
}));

router.delete('/:id', authenticate, requireRole('admin'), wrap(async (req, res) => {
  await pool.query('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

export default router;
