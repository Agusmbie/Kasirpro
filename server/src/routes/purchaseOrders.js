import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { wrap, AppError, nextInvoiceNumber, formatLocalDate } from '../utils/helpers.js';

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get('/', wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT po.id, po.invoice_no, po.supplier_id, s.name AS supplier_name,
            po.user_id, u.name AS user_name, po.transaction_date,
            po.total_amount, po.notes, po.created_at,
            (SELECT COUNT(*) FROM purchase_order_items i WHERE i.purchase_order_id = po.id) AS item_count
     FROM purchase_orders po
     LEFT JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN users u ON u.id = po.user_id
     ORDER BY po.id DESC`
  );
  res.json(rows);
}));

router.get('/:id', wrap(async (req, res) => {
  const [poRows] = await pool.query(
    `SELECT po.*, s.name AS supplier_name, u.name AS user_name
     FROM purchase_orders po
     LEFT JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN users u ON u.id = po.user_id
     WHERE po.id = ?`,
    [req.params.id]
  );
  if (poRows.length === 0) throw new AppError(404, 'Purchase order tidak ditemukan');
  const [items] = await pool.query(
    `SELECT i.id, i.product_id, p.sku, p.name AS product_name, i.qty, i.purchase_price
     FROM purchase_order_items i JOIN products p ON p.id = i.product_id
     WHERE i.purchase_order_id = ?`,
    [req.params.id]
  );
  res.json({ ...poRows[0], items });
}));

router.post('/', wrap(async (req, res) => {
  const { supplier_id, transaction_date, notes, items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'Items minimal 1 produk');
  }
  const date = transaction_date || formatLocalDate();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const invoice_no = await nextInvoiceNumber(conn, 'PO', new Date(date));

    const prepared = [];
    let total = 0;
    for (const it of items) {
      const productId = Number(it.product_id);
      const qty = Number(it.qty);
      if (!productId || !Number.isInteger(qty) || qty <= 0) {
        throw new AppError(400, 'Item tidak valid: product_id dan qty > 0 wajib diisi');
      }
      const [prod] = await conn.query(
        'SELECT id, name, purchase_price FROM products WHERE id = ? AND deleted_at IS NULL',
        [productId]
      );
      if (prod.length === 0) throw new AppError(404, `Produk id ${productId} tidak ditemukan`);
      const price = it.purchase_price != null ? Number(it.purchase_price) : Number(prod[0].purchase_price);
      prepared.push({ productId, qty, price });
      total += qty * price;
    }

    const [poRes] = await conn.query(
      `INSERT INTO purchase_orders (invoice_no, supplier_id, user_id, transaction_date, total_amount, notes)
       VALUES (?,?,?,?,?,?)`,
      [invoice_no, supplier_id || null, req.user.id, date, total, notes || null]
    );
    const poId = poRes.insertId;

    for (const p of prepared) {
      await conn.query(
        `INSERT INTO purchase_order_items (purchase_order_id, product_id, qty, purchase_price) VALUES (?,?,?,?)`,
        [poId, p.productId, p.qty, p.price]
      );
      await conn.query('UPDATE products SET current_stock = current_stock + ? WHERE id = ?', [p.qty, p.productId]);
      const [after] = await conn.query('SELECT current_stock FROM products WHERE id = ?', [p.productId]);
      await conn.query(
        `INSERT INTO stock_mutations (product_id, reference_type, reference_id, qty_change, stock_after, description)
         VALUES (?, 'purchase', ?, ?, ?, ?)`,
        [p.productId, poId, p.qty, after[0].current_stock, `Pembelian ${invoice_no}`]
      );
    }

    await conn.commit();
    res.status(201).json({ id: poId, invoice_no, total_amount: total });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

export default router;
