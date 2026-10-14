import app from '../server/src/app.js';
import { pool } from '../server/src/db/pool.js';

export default async function handler(req, res) {
  // Debug endpoint untuk melihat email
  if (req.url === '/api/debug-users') {
    try {
      const [rows] = await pool.query('SELECT email FROM users');
      return res.json(rows);
    } catch (e) {
      return res.json({ error: e.message });
    }
  }
  return app(req, res);
}
