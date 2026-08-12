import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { wrap, AppError } from '../utils/helpers.js';

const router = Router();

router.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    throw new AppError(400, 'Email dan password wajib diisi');
  }
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(String(password), user.password))) {
    throw new AppError(401, 'Email atau password salah');
  }
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'change-me-in-production',
    { expiresIn: '8h' }
  );
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

export default router;
