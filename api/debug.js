import app from '../server/src/app.js';
import { pool } from '../server/src/db/pool.js';

export default async function handler(req, res) {
  if (req.url === '/api/debug-users') {
    const [rows] = await pool.query('SELECT email FROM users');
    return res.json(rows);
  }
  return app(req, res);
}
