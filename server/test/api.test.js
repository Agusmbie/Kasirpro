import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mysql from 'mysql2/promise';
import { dbConfig, dbNameTest } from '../src/db/config.js';
import { applySchema } from '../src/db/schema.js';
import { formatLocalDate } from '../src/utils/helpers.js';

process.env.DB_NAME = dbNameTest();
process.env.NODE_ENV = 'test';

let app;
let pool;

before(async () => {
  const admin = {
    host: process.env.DB_ADMIN_HOST || process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_ADMIN_USER || 'root',
    password: process.env.DB_ADMIN_PASSWORD || '',
  };
  const adminConn = await mysql.createConnection(admin);
  await adminConn.query(`DROP DATABASE IF EXISTS \`${dbNameTest()}\``);
  await adminConn.query(`CREATE DATABASE \`${dbNameTest()}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await adminConn.end();

  const conn = await mysql.createConnection(dbConfig(dbNameTest()));
  await applySchema(conn);
  await conn.end();

  const { seed } = await import('../src/db/seed.js');
  await seed({ test: true });

  ({ default: app } = await import('../src/app.js'));
  ({ pool } = await import('../src/db/pool.js'));
});

after(async () => {
  if (pool) await pool.end();
});

async function login(email, password) {
  const res = await request(app).post('/api/login').send({ email, password });
  return res.body.token;
}

async function productBySku(token, sku) {
  const res = await request(app).get('/api/products').set('Authorization', `Bearer ${token}`);
  return res.body.find((p) => p.sku === sku);
}

describe('Autentikasi', () => {
  test('login admin sukses', async () => {
    const res = await request(app).post('/api/login').send({ email: 'admin@kasir.test', password: 'admin123' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.role, 'admin');
  });

  test('login password salah -> 401', async () => {
    const res = await request(app).post('/api/login').send({ email: 'admin@kasir.test', password: 'salah' });
    assert.equal(res.status, 401);
  });

  test('endpoint tanpa token -> 401', async () => {
    const res = await request(app).get('/api/products');
    assert.equal(res.status, 401);
  });

  test('admin endpoint ditolak untuk kasir -> 403', async () => {
    const token = await login('kasir@kasir.test', 'kasir123');
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 403);
  });
});

describe('Produk', () => {
  test('admin menambah produk', async () => {
    const token = await login('admin@kasir.test', 'admin123');
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ sku: 'TES-001', name: 'Produk Test', type: 'Sarung Jok', model: 'Avanza', category_id: null, unit: 'pcs', purchase_price: 1000, selling_price: 2000, initial_stock: 5 });
    assert.equal(res.status, 201);
    const listed = await productBySku(await login('admin@kasir.test', 'admin123'), 'TES-001');
    assert.equal(listed.type, 'Sarung Jok');
    assert.equal(listed.model, 'Avanza');
  });

  test('kasir tidak boleh menambah produk -> 403', async () => {
    const token = await login('kasir@kasir.test', 'kasir123');
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ sku: 'TES-002', name: 'Ditolak' });
    assert.equal(res.status, 403);
  });

  test('sku duplikat -> 409', async () => {
    const token = await login('admin@kasir.test', 'admin123');
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ sku: 'TES-001', name: 'Duplikat' });
    assert.equal(res.status, 409);
  });
});

describe('Penjualan (Kasir) — skenario PRD', () => {
  test('jual sukses: stok berkurang & mutasi tercatat', async () => {
    const token = await login('kasir@kasir.test', 'kasir123');
    const prod = await productBySku(token, 'SJ-001');
    const beforeStock = prod.current_stock;

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ customer_name: 'Test', paid_amount: 2000000, items: [{ product_id: prod.id, qty: 3 }] });
    assert.equal(res.status, 201);
    assert.match(res.body.invoice_no, /^INV-\d{8}-/);
    assert.equal(res.body.change_amount, 2000000 - 3 * 350000);

    const after = await productBySku(token, 'SJ-001');
    assert.equal(after.current_stock, beforeStock - 3);

    const mut = await request(app)
      .get(`/api/stock-mutations?product_id=${prod.id}`)
      .set('Authorization', `Bearer ${await login('admin@kasir.test', 'admin123')}`);
    assert.equal(mut.status, 200);
    const saleMut = mut.body.find((m) => m.reference_type === 'sale' && m.qty_change === -3);
    assert.ok(saleMut);
    assert.equal(saleMut.stock_after, beforeStock - 3);
  });

  test('bisa proses bayar pakai harga beli (override harga per item)', async () => {
    const token = await login('kasir@kasir.test', 'kasir123');
    const prod = await productBySku(token, 'TES-001');
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ paid_amount: 100000, items: [{ product_id: prod.id, qty: 1, price: Number(prod.purchase_price) }] });
    assert.equal(res.status, 201);
    assert.equal(Number(res.body.grand_total), Number(prod.purchase_price));
    const detail = await request(app)
      .get(`/api/sales/${res.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(detail.status, 200);
    assert.equal(Number(detail.body.items[0].selling_price), Number(prod.purchase_price));
    assert.equal(Number(detail.body.subtotal), Number(prod.purchase_price));
  });

  test('jual qty > stok ditolak, stok tidak berubah', async () => {
    const token = await login('kasir@kasir.test', 'kasir123');
    const prod = await productBySku(token, 'SJ-002');
    const beforeStock = prod.current_stock;

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ paid_amount: 9999999, items: [{ product_id: prod.id, qty: beforeStock + 5 }] });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Stok tidak mencukupi \(Sisa: /);

    const after = await productBySku(token, 'SJ-002');
    assert.equal(after.current_stock, beforeStock);
  });

  test('uang bayar kurang ditolak', async () => {
    const token = await login('kasir@kasir.test', 'kasir123');
    const prod = await productBySku(token, 'SJ-003');
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ paid_amount: 1000, items: [{ product_id: prod.id, qty: 1 }] });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Uang bayar kurang/);
  });

  test('struk PDF ter-generate', async () => {
    const token = await login('kasir@kasir.test', 'kasir123');
    const prod = await productBySku(token, 'SS-001');
    const sale = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ paid_amount: 100000, items: [{ product_id: prod.id, qty: 1 }] });
    const receipt = await request(app)
      .get(`/api/sales/${sale.body.id}/receipt`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(receipt.status, 200);
    assert.match(receipt.headers['content-type'], /application\/pdf/);
  });
});

describe('Pembelian (Stok Masuk)', () => {
  test('PO menambah stok & mencatat mutasi', async () => {
    const token = await login('admin@kasir.test', 'admin123');
    const prod = await productBySku(token, 'KM-001');
    const beforeStock = prod.current_stock;

    const res = await request(app)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ supplier_id: null, items: [{ product_id: prod.id, qty: 10 }] });
    assert.equal(res.status, 201);
    assert.match(res.body.invoice_no, /^PO-\d{8}-/);

    const after = await productBySku(token, 'KM-001');
    assert.equal(after.current_stock, beforeStock + 10);

    const mut = await request(app)
      .get(`/api/stock-mutations?product_id=${prod.id}`)
      .set('Authorization', `Bearer ${token}`);
    const poMut = mut.body.find((m) => m.reference_type === 'purchase' && m.qty_change === 10);
    assert.ok(poMut);
  });

  test('PO bisa diedit: stok & total diperbarui', async () => {
    const token = await login('admin@kasir.test', 'admin123');
    const prodA = await productBySku(token, 'SJ-001');
    const prodB = await productBySku(token, 'SJ-002');

    const po = await request(app)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ product_id: prodA.id, qty: 2, purchase_price: 1000 }] });
    assert.equal(po.status, 201);
    assert.equal((await productBySku(token, 'SJ-001')).current_stock, prodA.current_stock + 2);

    const put = await request(app)
      .put(`/api/purchase-orders/${po.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [
        { product_id: prodA.id, qty: 1, purchase_price: 1000 },
        { product_id: prodB.id, qty: 3, purchase_price: 500 },
      ] });
    assert.equal(put.status, 200);
    assert.equal(Number(put.body.total_amount), 2500);
    assert.equal((await productBySku(token, 'SJ-001')).current_stock, prodA.current_stock + 1);
    assert.equal((await productBySku(token, 'SJ-002')).current_stock, prodB.current_stock + 3);

    const detail = await request(app).get(`/api/purchase-orders/${po.body.id}`).set('Authorization', `Bearer ${token}`);
    assert.equal(detail.body.items.length, 2);

    const del = await request(app).delete(`/api/purchase-orders/${po.body.id}`).set('Authorization', `Bearer ${token}`);
    assert.equal(del.status, 200);
    assert.equal((await productBySku(token, 'SJ-001')).current_stock, prodA.current_stock);
    assert.equal((await productBySku(token, 'SJ-002')).current_stock, prodB.current_stock);
  });

  test('kasir tidak boleh edit/hapus PO -> 403', async () => {
    const token = await login('kasir@kasir.test', 'kasir123');
    assert.equal((await request(app).put('/api/purchase-orders/1').set('Authorization', `Bearer ${token}`).send({ items: [{ product_id: 1, qty: 1 }] })).status, 403);
    assert.equal((await request(app).delete('/api/purchase-orders/1').set('Authorization', `Bearer ${token}`)).status, 403);
  });
});


describe('Tambah Stok Cepat (adjustment)', () => {
  test('admin menambah stok: stok naik & mutasi adjustment tercatat', async () => {
    const adminToken = await login('admin@kasir.test', 'admin123');
    const prod = await productBySku(adminToken, 'TES-001');
    const beforeStock = prod.current_stock;

    const res = await request(app)
      .post(`/api/products/${prod.id}/stock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qty: 5, note: 'Stok tambahan tes' });
    assert.equal(res.status, 200);
    assert.equal(res.body.current_stock, beforeStock + 5);

    const after = await productBySku(adminToken, 'TES-001');
    assert.equal(after.current_stock, beforeStock + 5);

    const mut = await request(app)
      .get(`/api/stock-mutations?product_id=${prod.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const adj = mut.body.find((m) => m.reference_type === 'adjustment' && m.qty_change === 5);
    assert.ok(adj);
    assert.equal(adj.stock_after, beforeStock + 5);
    assert.equal(adj.description, 'Stok tambahan tes');
  });

  test('kasir tidak boleh menambah stok -> 403', async () => {
    const cashierToken = await login('kasir@kasir.test', 'kasir123');
    const prod = await productBySku(cashierToken, 'TES-001');
    const res = await request(app)
      .post(`/api/products/${prod.id}/stock`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ qty: 5 });
    assert.equal(res.status, 403);
  });

  test('qty <= 0 -> 400', async () => {
    const adminToken = await login('admin@kasir.test', 'admin123');
    const prod = await productBySku(adminToken, 'TES-001');
    const res = await request(app)
      .post(`/api/products/${prod.id}/stock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qty: 0 });
    assert.equal(res.status, 400);
  });

  test('produk dihapus (soft delete) -> 404', async () => {
    const adminToken = await login('admin@kasir.test', 'admin123');
    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sku: 'HAPUS-001', name: 'Produk Dihapus', initial_stock: 0 });
    assert.equal(created.status, 201);
    await request(app)
      .delete(`/api/products/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const res = await request(app)
      .post(`/api/products/${created.body.id}/stock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qty: 1 });
    assert.equal(res.status, 404);
  });
});

describe('Type & Model (master data)', () => {
  test('admin menambah type & model', async () => {
    const adminToken = await login('admin@kasir.test', 'admin123');
    const typeRes = await request(app).post('/api/types').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Test Type' });
    assert.equal(typeRes.status, 201);
    const modelRes = await request(app).post('/api/models').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Test Model' });
    assert.equal(modelRes.status, 201);
    const list = await request(app).get('/api/types').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(list.status, 200);
    assert.ok(list.body.some((t) => t.name === 'Test Type'));
  });

  test('duplikat type -> 409', async () => {
    const adminToken = await login('admin@kasir.test', 'admin123');
    const res = await request(app).post('/api/types').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Test Type' });
    assert.equal(res.status, 409);
  });

  test('kasir tidak boleh tambah type -> 403', async () => {
    const cashierToken = await login('kasir@kasir.test', 'kasir123');
    const res = await request(app).post('/api/types').set('Authorization', `Bearer ${cashierToken}`).send({ name: 'X' });
    assert.equal(res.status, 403);
  });
});

describe('Laba Kotor', () => {
  test('laporan laba per produk & total', async () => {
    const adminToken = await login('admin@kasir.test', 'admin123');
    const cashierToken = await login('kasir@kasir.test', 'kasir123');

    const prod = await productBySku(adminToken, 'TES-001');
    const sale = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ paid_amount: 10000, items: [{ product_id: prod.id, qty: 2 }] });
    assert.equal(sale.status, 201);

    const res = await request(app).get('/api/reports/profit').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.items));
    const row = res.body.items.find((r) => r.id === prod.id);
    assert.ok(row);
    assert.equal(row.qty_sold, 3);
    assert.equal(Number(row.revenue), 5000);
    assert.equal(Number(row.cost), 3000);
    assert.equal(Number(row.profit), 2000);
    assert.ok(res.body.totals);
    assert.equal(Number(res.body.totals.profit) >= 2000, true);

    const detail = await request(app)
      .get(`/api/sales/${sale.body.id}`)
      .set('Authorization', `Bearer ${cashierToken}`);
    assert.equal(detail.status, 200);
    assert.equal(Number(detail.body.items[0].purchase_price), 1000);
  });

  test('kasir tidak boleh akses laporan laba -> 403', async () => {
    const cashierToken = await login('kasir@kasir.test', 'kasir123');
    const res = await request(app).get('/api/reports/profit').set('Authorization', `Bearer ${cashierToken}`);
    assert.equal(res.status, 403);
  });

  test('dashboard menyertakan laba kotor hari ini', async () => {
    const adminToken = await login('admin@kasir.test', 'admin123');
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.todayProfit, 'number');
  });
});

describe('Bersihkan Semua Transaksi', () => {
  test('hapus semua data penjualan tanpa mengubah stok', async () => {
    const adminToken = await login('admin@kasir.test', 'admin123');
    const cashierToken = await login('kasir@kasir.test', 'kasir123');
    const prod = await productBySku(adminToken, 'AK-001');
    const stockBefore = prod.current_stock;

    await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ paid_amount: 100000, items: [{ product_id: prod.id, qty: 1 }] });
    const listBefore = await request(app).get('/api/sales').set('Authorization', `Bearer ${cashierToken}`);
    assert.ok(listBefore.body.length >= 1);

    const res = await request(app).delete('/api/sales').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.deleted >= 1);

    const listAfter = await request(app).get('/api/sales').set('Authorization', `Bearer ${cashierToken}`);
    assert.equal(listAfter.body.length, 0);

    const stockAfter = await productBySku(adminToken, 'AK-001');
    assert.equal(stockAfter.current_stock, stockBefore - 1);

    const mut = await request(app)
      .get('/api/stock-mutations')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.ok(!mut.body.some((m) => m.reference_type === 'sale'));
  });

  test('kasir tidak boleh bersihkan transaksi -> 403', async () => {
    const cashierToken = await login('kasir@kasir.test', 'kasir123');
    const res = await request(app).delete('/api/sales').set('Authorization', `Bearer ${cashierToken}`);
    assert.equal(res.status, 403);
  });
});

describe('Laporan Mingguan & Bulanan', () => {
  test('konsisten: harian = mingguan = bulanan untuk hari ini', async () => {
    const adminToken = await login('admin@kasir.test', 'admin123');
    const cashierToken = await login('kasir@kasir.test', 'kasir123');
    const prod = await productBySku(adminToken, 'AK-001');
    const qty = 2;
    const expectedCost = Number(prod.purchase_price) * qty;
    const expectedRevenue = Number(prod.selling_price) * qty;
    const expectedProfit = expectedRevenue - expectedCost;

    const sale = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ paid_amount: 1000000, items: [{ product_id: prod.id, qty, price: Number(prod.purchase_price) }] });
    assert.equal(sale.status, 201);

    const today = formatLocalDate();
    const d = new Date();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const mondayKey = formatLocalDate(monday);
    const monthKey = today.slice(0, 7);

    const daily = await request(app).get('/api/reports/daily').set('Authorization', `Bearer ${adminToken}`);
    const dayRow = daily.body.find((r) => r.period === today);
    assert.ok(dayRow, 'baris harian hari ini ada');
    assert.equal(dayRow.cost_total, expectedCost);
    assert.equal(dayRow.revenue_total, expectedRevenue);
    assert.equal(dayRow.profit_total, expectedProfit);
    assert.equal(dayRow.total, Number(sale.body.grand_total));

    const weekly = await request(app).get('/api/reports/weekly').set('Authorization', `Bearer ${adminToken}`);
    const weekRow = weekly.body.find((r) => r.period === mondayKey);
    assert.ok(weekRow, 'baris mingguan ada');
    assert.equal(weekRow.cost_total, expectedCost);
    assert.equal(weekRow.revenue_total, expectedRevenue);
    assert.equal(weekRow.profit_total, expectedProfit);

    const monthly = await request(app).get('/api/reports/monthly').set('Authorization', `Bearer ${adminToken}`);
    const monthRow = monthly.body.find((r) => r.period === monthKey);
    assert.ok(monthRow, 'baris bulanan ada');
    assert.equal(monthRow.cost_total, expectedCost);
    assert.equal(monthRow.revenue_total, expectedRevenue);
    assert.equal(monthRow.profit_total, expectedProfit);

    const dDetail = await request(app).get(`/api/reports/daily/${today}`).set('Authorization', `Bearer ${adminToken}`);
    assert.equal(dDetail.body.totals.cost_total, expectedCost);
    assert.equal(dDetail.body.totals.profit_total, expectedProfit);
    const wDetail = await request(app).get(`/api/reports/weekly/${mondayKey}`).set('Authorization', `Bearer ${adminToken}`);
    assert.equal(wDetail.body.totals.revenue_total, expectedRevenue);
    const mDetail = await request(app).get(`/api/reports/monthly/${monthKey}`).set('Authorization', `Bearer ${adminToken}`);
    assert.equal(mDetail.body.totals.profit_total, expectedProfit);
  });

  test('kasir tidak boleh akses mingguan/bulanan -> 403', async () => {
    const cashierToken = await login('kasir@kasir.test', 'kasir123');
    assert.equal((await request(app).get('/api/reports/weekly').set('Authorization', `Bearer ${cashierToken}`)).status, 403);
    assert.equal((await request(app).get('/api/reports/monthly').set('Authorization', `Bearer ${cashierToken}`)).status, 403);
  });
});

describe('Gambar Produk', () => {
  test('produk bisa simpan gambar (data url)', async () => {
    const adminToken = await login('admin@kasir.test', 'admin123');
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sku: 'IMG-001', name: 'Produk Gambar', image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' });
    assert.equal(res.status, 201);
    const listed = await productBySku(adminToken, 'IMG-001');
    assert.ok(listed.image && listed.image.startsWith('data:image/'));
  });

  test('gambar tidak valid -> 400', async () => {
    const adminToken = await login('admin@kasir.test', 'admin123');
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sku: 'IMG-002', name: 'Gambar Salah', image: 'http://x/y.png' });
    assert.equal(res.status, 400);
  });
});

describe('Laporan Harian', () => {
  test('ringkasan harian otomatis dari data penjualan', async () => {
    const adminToken = await login('admin@kasir.test', 'admin123');
    const res = await request(app).get('/api/reports/daily').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    if (res.body.length > 0) {
      assert.ok(res.body[0].transaction_count >= 1);
      const detail = await request(app).get(`/api/reports/daily/${res.body[0].date}`).set('Authorization', `Bearer ${adminToken}`);
      assert.equal(detail.status, 200);
      assert.ok(Array.isArray(detail.body.sales));
      assert.ok(detail.body.totals);
    }
  });

  test('kasir tidak boleh akses laporan harian -> 403', async () => {
    const cashierToken = await login('kasir@kasir.test', 'kasir123');
    const res = await request(app).get('/api/reports/daily').set('Authorization', `Bearer ${cashierToken}`);
    assert.equal(res.status, 403);
  });
});

describe('Hapus data di Laporan', () => {
  test('hapus transaksi: stok dikembalikan & catatan hilang', async () => {
    const adminToken = await login('admin@kasir.test', 'admin123');
    const cashierToken = await login('kasir@kasir.test', 'kasir123');
    const prod = await productBySku(adminToken, 'AK-001');
    const beforeStock = prod.current_stock;

    const sale = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ paid_amount: 100000, items: [{ product_id: prod.id, qty: 2 }] });
    assert.equal(sale.status, 201);

    const del = await request(app)
      .delete(`/api/sales/${sale.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(del.status, 200);

    const after = await productBySku(adminToken, 'AK-001');
    assert.equal(after.current_stock, beforeStock);

    const mut = await request(app)
      .get(`/api/stock-mutations?product_id=${prod.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.ok(!mut.body.some((m) => m.reference_type === 'sale' && m.reference_id === sale.body.id));
  });

  test('kasir tidak boleh hapus transaksi -> 403', async () => {
    const cashierToken = await login('kasir@kasir.test', 'kasir123');
    const adminToken = await login('admin@kasir.test', 'admin123');
    const prod = await productBySku(adminToken, 'AK-001');
    const sale = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ paid_amount: 100000, items: [{ product_id: prod.id, qty: 1 }] });
    const res = await request(app)
      .delete(`/api/sales/${sale.body.id}`)
      .set('Authorization', `Bearer ${cashierToken}`);
    assert.equal(res.status, 403);
  });
});

describe('Dashboard & Laporan', () => {
  test('dashboard mengembalikan ringkasan', async () => {
    const token = await login('admin@kasir.test', 'admin123');
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.todayRevenue >= 0);
    assert.ok(Array.isArray(res.body.lowStockProducts));
  });

  test('export mutasi menghasilkan xlsx', async () => {
    const token = await login('admin@kasir.test', 'admin123');
    const res = await request(app).get('/api/stock-mutations/export').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /spreadsheetml/);
  });
});
