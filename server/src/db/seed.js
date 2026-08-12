import bcrypt from 'bcryptjs';
import { makePool } from './pool.js';
import { dbName, dbNameTest } from './config.js';
import { localDateKey } from '../utils/helpers.js';

export async function seed({ test = false } = {}) {
  const database = test ? dbNameTest() : dbName();
  const pool = makePool(database);
  const conn = await pool.getConnection();
  try {
    const adminHash = await bcrypt.hash('admin123', 10);
    const cashierHash = await bcrypt.hash('kasir123', 10);

    await conn.query(
      `INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      ['Admin', 'admin@kasir.test', adminHash, 'admin']
    );
    await conn.query(
      `INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      ['Kasir', 'kasir@kasir.test', cashierHash, 'cashier']
    );
    console.log('User seed: admin@kasir.test / admin123, kasir@kasir.test / kasir123');

    const categories = [
      ['Sarung Jok'],
      ['Sarung Setir'],
      ['Karpet Mobil'],
      ['Aksesoris'],
    ];
    const catIds = [];
    for (const [name] of categories) {
      const [r] = await conn.query(
        `INSERT INTO categories (name) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        [name]
      );
      catIds.push(r.insertId);
    }

    const typeNames = [
      'Beat', 'Vario', 'Scoopy', 'Genio', 'PCX', 'ADV', 'Forza', 'Stylo',
      'Supra X 125', 'Supra GTR 150', 'Revo', 'Sonic 150', 'CB150R', 'CBR150R',
      'CBR250RR', 'CRF150L', 'CRF250L', 'XR150L', 'Monkey 125', 'Super Cub C125',
      'CT125 Hunter Cub', 'Trail 125', 'Spacy 125', 'EM1 e:', 'CUV e:',
      'NMAX', 'Lexi', 'Aerox', 'Fazzio', 'Freego', 'Xeon 125', 'Mio', 'Mio Z',
      'Fino', 'Vixion', 'R15', 'MT-15', 'R25', 'MT-25', 'XSR 155', 'WR155',
      'Jupiter Z1', 'Vega Force', 'Gear 125', 'Byson',
      'Satria F150', 'GSX-R150', 'GSX-S150', 'GSX-R250', 'Address 110', 'Nex II',
      'Smash', 'Hayate', 'Raider 150', 'Thunder 125',
    ];
    for (const t of typeNames) {
      await conn.query('INSERT IGNORE INTO types (name) VALUES (?)', [t.trim()]);
    }
    await conn.query('UPDATE types SET name = TRIM(name)');
    const modelNames = [
      'Beat 110', 'Beat 125', 'Vario 125', 'Vario 160', 'Scoopy 110', 'PCX 160',
      'ADV 160', 'NMAX 155', 'Lexi 125', 'Lexi LX 155', 'Aerox 155', 'Fazzio 125',
      'Mio M3', 'Mio Soul', 'Satria F150', 'GSX-R150',
      'Benang Putih', 'Benang Merah', 'Benang Biru', 'Benang Hitam', 'Default', 'Universal',
    ];
    for (const m of modelNames) {
      await conn.query('INSERT IGNORE INTO models (name) VALUES (?)', [m]);
    }
    console.log('Seed type & model selesai.');

    const suppliers = [
      ['PT Sumber Pangan', '081234567890', 'Jl. Raya No. 1'],
      ['CV Berkah Jaya', '081298765432', 'Jl. Melati No. 2'],
    ];
    const supIds = [];
    for (const [name, phone, address] of suppliers) {
      const [r] = await conn.query(
        `INSERT INTO suppliers (name, phone, address) VALUES (?,?,?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        [name, phone, address]
      );
      supIds.push(r.insertId);
    }

    const products = [
      ['SJ-001', 'Sarung Jok Avanza', catIds[0], 'Sarung Jok', 'Avanza', 'set', 250000, 350000, 20],
      ['SJ-002', 'Sarung Jok Xenia', catIds[0], 'Sarung Jok', 'Xenia', 'set', 250000, 350000, 15],
      ['SJ-003', 'Sarung Jok Inova', catIds[0], 'Sarung Jok', 'Inova', 'set', 300000, 400000, 10],
      ['SS-001', 'Sarung Setir Avanza', catIds[1], 'Sarung Setir', 'Avanza', 'pcs', 50000, 75000, 25],
      ['KM-001', 'Karpet Mobil Avanza', catIds[2], 'Karpet', 'Avanza', 'set', 120000, 180000, 8],
      ['AK-001', 'Gantungan Kunci Mobil', catIds[3], 'Aksesoris', 'Universal', 'pcs', 8000, 15000, 40],
    ];
    for (const [sku, name, categoryId, type, model, unit, purchasePrice, sellingPrice, stock] of products) {
      const [existing] = await conn.query(`SELECT id FROM products WHERE sku = ?`, [sku]);
      if (existing.length > 0) {
        await conn.query(
          `UPDATE products SET name=?, type=?, model=?, category_id=?, unit=?, purchase_price=?, selling_price=?, deleted_at=NULL WHERE sku=?`,
          [name, type, model, categoryId, unit, purchasePrice, sellingPrice, sku]
        );
        continue;
      }
      const [r] = await conn.query(
        `INSERT INTO products (sku, name, type, model, category_id, unit, purchase_price, selling_price, current_stock)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [sku, name, type, model, categoryId, unit, purchasePrice, sellingPrice, stock]
      );
      if (stock > 0) {
        await conn.query(
          `INSERT INTO stock_mutations (product_id, reference_type, reference_id, qty_change, stock_after, description)
           VALUES (?, 'initial', ?, ?, ?, 'Stok awal')`,
          [r.insertId, r.insertId, stock, stock]
        );
      }
    }


    const { VARIANT_IMAGES } = await import('./productImages.js');
    const variantModels = ['Benang Putih', 'Benang Merah', 'Benang Biru', 'Benang Hitam', 'Default', 'Universal'];
    const [typeRows] = await conn.query('SELECT name FROM types ORDER BY id');
    const [comboRows] = await conn.query(
      `SELECT TRIM(type) AS type, TRIM(model) AS model FROM products WHERE deleted_at IS NULL`
    );
    const existingSet = new Set(comboRows.map((r) => `${r.type}|${r.model}`));
    let catalogCount = 0;
    for (const t of typeRows) {
      const type = t.name.trim();
      for (const variant of variantModels) {
        if (existingSet.has(`${type}|${variant}`)) continue;
        const sku = 'SJ-' + type.replace(/[^a-zA-Z0-9]+/g, '').toUpperCase().slice(0, 24) + '-' + variant.replace(/[^a-zA-Z0-9]+/g, '').toUpperCase();
        const name = `Sarung Jok ${type} ${variant}`;
        await conn.query(
          `INSERT INTO products (sku, name, type, model, category_id, unit, purchase_price, selling_price, current_stock, image)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [sku, name, type, variant, catIds[0], 'pcs', 0, 0, 0, VARIANT_IMAGES[variant]]
        );
        catalogCount++;
      }
    }
    console.log(`Seed katalog produk (type x varian): ${catalogCount} produk ditambahkan.`);

    console.log('Seed data: kategori, supplier, produk selesai.');
  } finally {
    conn.release();
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^file:\/\//, ''))) {
  seed().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
