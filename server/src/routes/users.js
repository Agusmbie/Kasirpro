import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { wrap, AppError } from '../utils/helpers.js';

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get('/', wrap(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, name, email, role, created_at FROM users ORDER BY id'
  );
  res.json(rows);
}));

router.post('/', wrap(async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) throw new AppError(400, 'name, email, password wajib diisi');
  if (!['admin', 'cashier'].includes(role)) throw new AppError(400, 'Role harus admin atau cashier');
  const hash = await bcrypt.hash(String(password), 10);
  try {
    const [r] = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)',
      [name, email, hash, role]
    );
    res.status(201).json({ id: r.insertId, name, email, role });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new AppError(409, 'Email sudah terdaftar');
    throw e;
  }
}));

router.put('/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { name, email, role, password } = req.body || {};
  if (!name || !email) throw new AppError(400, 'name dan email wajib diisi');
  if (role && !['admin', 'cashier'].includes(role)) throw new AppError(400, 'Role harus admin atau cashier');
  const fields = ['name = ?', 'email = ?', 'role = ?'];
  const params = [name, email, role || 'cashier'];
  if (password) {
    fields.push('password = ?');
    params.push(await bcrypt.hash(String(password), 10));
  }
  params.push(id);
  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
  res.json({ ok: true });
}));

router.delete('/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw new AppError(400, 'Tidak bisa menghapus akun sendiri');
  const [r] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
  if (r.affectedRows === 0) throw new AppError(404, 'User tidak ditemukan');
  res.json({ ok: true });
}));

export default router;
