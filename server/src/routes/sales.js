import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { wrap, AppError, nextInvoiceNumber } from '../utils/helpers.js';
import { buildReceiptPDF } from '../utils/receiptPdf.js';

const router = Router();
router.use(authenticate);

router.get('/', wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.id, s.invoice_no, s.user_id, u.name AS user_name, s.customer_name,
            s.transaction_date, s.subtotal, s.discount, s.grand_total, s.paid_amount, s.change_amount
     FROM sales s LEFT JOIN users u ON u.id = s.user_id
     ORDER BY s.id DESC`
  );
  res.json(rows);
}));

router.get('/:id', wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.*, u.name AS user_name
     FROM sales s LEFT JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) throw new AppError(404, 'Transaksi tidak ditemukan');
  const [items] = await pool.query(
    `SELECT si.id, si.product_id, p.sku, p.name AS product_name, si.qty, si.selling_price, si.purchase_price
     FROM sale_items si JOIN products p ON p.id = si.product_id WHERE si.sale_id = ?`,
    [req.params.id]
  );
  res.json({ ...rows[0], items });
}));

router.delete('/', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[cnt]] = await conn.query('SELECT COUNT(*) AS total FROM sales');
    await conn.query('DELETE FROM sale_items');
    await conn.query(`DELETE FROM stock_mutations WHERE reference_type = 'sale'`);
    await conn.query('DELETE FROM sales');
    await conn.commit();
    res.json({ ok: true, deleted: Number(cnt.total) });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

router.delete('/:id', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [saleRows] = await conn.query('SELECT id FROM sales WHERE id = ?', [id]);
    if (saleRows.length === 0) throw new AppError(404, 'Transaksi tidak ditemukan');
    const [items] = await conn.query('SELECT product_id, qty FROM sale_items WHERE sale_id = ?', [id]);
    for (const it of items) {
      await conn.query('UPDATE products SET current_stock = current_stock + ? WHERE id = ?', [it.qty, it.product_id]);
    }
    await conn.query('DELETE FROM sale_items WHERE sale_id = ?', [id]);
    await conn.query(`DELETE FROM stock_mutations WHERE reference_type = 'sale' AND reference_id = ?`, [id]);
    await conn.query('DELETE FROM sales WHERE id = ?', [id]);
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

router.get('/:id/receipt', wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.*, u.name AS user_name FROM sales s LEFT JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) throw new AppError(404, 'Transaksi tidak ditemukan');
  const [items] = await pool.query(
    `SELECT si.product_id, p.name AS product_name, si.qty, si.selling_price
     FROM sale_items si JOIN products p ON p.id = si.product_id WHERE si.sale_id = ?`,
    [req.params.id]
  );
  const pdf = await buildReceiptPDF({ sale: rows[0], items });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="struk-${rows[0].invoice_no}.pdf"`);
  res.send(pdf);
}));

router.post('/', wrap(async (req, res) => {
  const { customer_name, discount = 0, paid_amount, items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'Items minimal 1 produk');
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const invoice_no = await nextInvoiceNumber(conn, 'INV');

    let subtotal = 0;
    const rows = [];
    for (const it of items) {
      const productId = Number(it.product_id);
      const qty = Number(it.qty);
      if (!productId || !Number.isInteger(qty) || qty <= 0) {
        throw new AppError(400, 'Item tidak valid: product_id dan qty > 0 wajib diisi');
      }
      const [prod] = await conn.query(
        'SELECT id, name, current_stock, selling_price, purchase_price FROM products WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
        [productId]
      );
      if (prod.length === 0) throw new AppError(404, `Produk id ${productId} tidak ditemukan`);
      if (qty > prod[0].current_stock) {
        throw new AppError(400, `Stok tidak mencukupi (Sisa: ${prod[0].current_stock})`);
      }
      const price = it.price != null && Number(it.price) >= 0 ? Number(it.price) : Number(prod[0].selling_price);
      rows.push({ productId, qty, price, cost: Number(prod[0].purchase_price || 0), listPrice: Number(prod[0].selling_price || 0), name: prod[0].name });
      subtotal += qty * price;
    }

    const grandTotal = subtotal - Number(discount || 0);
    if (grandTotal < 0) throw new AppError(400, 'Diskon tidak boleh melebihi subtotal');
    const paid = Number(paid_amount || 0);
    if (paid < grandTotal) {
      throw new AppError(400, `Uang bayar kurang: Rp ${(grandTotal - paid).toLocaleString('id-ID')}`);
    }

    const [saleRes] = await conn.query(
      `INSERT INTO sales (invoice_no, user_id, customer_name, subtotal, discount, grand_total, paid_amount, change_amount)
       VALUES (?,?,?,?,?,?,?,?)`,
      [invoice_no, req.user.id, customer_name || 'Umum', subtotal, Number(discount || 0), grandTotal, paid, paid - grandTotal]
    );
    const saleId = saleRes.insertId;

    for (const r of rows) {
      await conn.query(
        `INSERT INTO sale_items (sale_id, product_id, qty, selling_price, purchase_price, list_price) VALUES (?,?,?,?,?,?)`,
        [saleId, r.productId, r.qty, r.price, r.cost, r.listPrice]
      );
      await conn.query('UPDATE products SET current_stock = current_stock - ? WHERE id = ?', [r.qty, r.productId]);
      const [after] = await conn.query('SELECT current_stock FROM products WHERE id = ?', [r.productId]);
      await conn.query(
        `INSERT INTO stock_mutations (product_id, reference_type, reference_id, qty_change, stock_after, description)
         VALUES (?, 'sale', ?, ?, ?, ?)`,
        [r.productId, saleId, -r.qty, after[0].current_stock, `Penjualan ${invoice_no}`]
      );
    }

    await conn.commit();
    const [detail] = await pool.query(
      `SELECT s.*, u.name AS user_name FROM sales s LEFT JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
      [saleId]
    );
    res.status(201).json({ ...detail[0], items: rows.map((r) => ({ product_id: r.productId, qty: r.qty, selling_price: r.price })) });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

export default router;
