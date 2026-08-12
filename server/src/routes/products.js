import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { wrap, AppError } from '../utils/helpers.js';

const router = Router();

function normalizeImage(image) {
  if (image == null || image === '') return null;
  if (typeof image !== 'string' || !image.startsWith('data:image/') || image.length > 300000) {
    throw new AppError(400, 'Gambar tidak valid (harus file gambar, maksimal ±200KB)');
  }
  return image;
}

router.get('/', authenticate, wrap(async (req, res) => {
  const { q, category_id } = req.query;
  let sql = `
    SELECT p.id, p.sku, p.name, p.type, p.model, p.image, p.category_id, c.name AS category_name, p.unit,
           p.purchase_price, p.selling_price, p.current_stock, p.created_at, p.updated_at
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.deleted_at IS NULL`;
  const params = [];
  if (q) {
    sql += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  if (category_id) {
    sql += ' AND p.category_id = ?';
    params.push(Number(category_id));
  }
  sql += ' ORDER BY p.name';
  const [rows] = await pool.query(sql, params);
  res.json(rows);
}));

router.post('/', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const { sku, name, type, model, image, category_id, unit, purchase_price, selling_price, initial_stock } = req.body || {};
  if (!sku || !name) throw new AppError(400, 'SKU dan nama produk wajib diisi');
  const img = normalizeImage(image);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      `INSERT INTO products (sku, name, type, model, image, category_id, unit, purchase_price, selling_price, current_stock)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [sku, name, type || null, model || null, img, category_id || null, unit || 'pcs', purchase_price || 0, selling_price || 0, initial_stock || 0]
    );
    const stock = Number(initial_stock || 0);
    if (stock > 0) {
      await conn.query(
        `INSERT INTO stock_mutations (product_id, reference_type, reference_id, qty_change, stock_after, description)
         VALUES (?, 'initial', ?, ?, ?, 'Stok awal')`,
        [r.insertId, r.insertId, stock, stock]
      );
    }
    await conn.commit();
    res.status(201).json({ id: r.insertId, sku, name });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') throw new AppError(409, 'SKU sudah digunakan');
    throw e;
  } finally {
    conn.release();
  }
}));

router.put('/:id', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const { sku, name, type, model, image, category_id, unit, purchase_price, selling_price } = req.body || {};
  if (!sku || !name) throw new AppError(400, 'SKU dan nama produk wajib diisi');
  const img = normalizeImage(image);
  try {
    const [r] = await pool.query(
      `UPDATE products SET sku=?, name=?, type=?, model=?, image=?, category_id=?, unit=?, purchase_price=?, selling_price=? WHERE id=? AND deleted_at IS NULL`,
      [sku, name, type || null, model || null, img, category_id || null, unit || 'pcs', purchase_price || 0, selling_price || 0, req.params.id]
    );
    if (r.affectedRows === 0) throw new AppError(404, 'Produk tidak ditemukan');
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new AppError(409, 'SKU sudah digunakan');
    throw e;
  }
}));

router.post('/:id/stock', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const qty = Number(req.body?.qty);
  const note = (req.body?.note || 'Penambahan stok manual').toString().slice(0, 255);
  if (!Number.isInteger(qty) || qty <= 0) throw new AppError(400, 'Qty harus bilangan bulat lebih dari 0');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [prod] = await conn.query('SELECT id FROM products WHERE id = ? AND deleted_at IS NULL', [id]);
    if (prod.length === 0) throw new AppError(404, 'Produk tidak ditemukan');
    await conn.query('UPDATE products SET current_stock = current_stock + ? WHERE id = ?', [qty, id]);
    const [after] = await conn.query('SELECT current_stock FROM products WHERE id = ?', [id]);
    await conn.query(
      `INSERT INTO stock_mutations (product_id, reference_type, reference_id, qty_change, stock_after, description)
       VALUES (?, 'adjustment', ?, ?, ?, ?)`,
      [id, id, qty, after[0].current_stock, note]
    );
    await conn.commit();
    res.json({ ok: true, current_stock: after[0].current_stock });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

router.delete('/:id', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const [r] = await pool.query(
    'UPDATE products SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
    [req.params.id]
  );
  if (r.affectedRows === 0) throw new AppError(404, 'Produk tidak ditemukan');
  res.json({ ok: true });
}));

export default router;
