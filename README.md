# KasPro — Aplikasi POS (Kasir & Manajemen Stok)

Implementasi dari `kasir-prd.md` dengan stack **Node.js (Express) + MySQL/MariaDB** dan frontend **React + Vite + Bootstrap 5**, auth **JWT**.

## Fitur (Modul A–E sesuai PRD)
- Autentikasi & manajemen user (role `admin` / `cashier`)
- Master data: produk (soft delete), kategori, supplier
- Pembelian / stok masuk (PO) → stok bertambah + mutasi
- Kasir / POS: validasi stok, keranjang, hitung kembalian, struk PDF
- Histori mutasi stok (filter produk & tanggal) + export Excel (.xlsx)
- Dashboard: pendapatan hari ini, total transaksi, produk stok menipis (< 10)

## Prasyarat
- Node.js ≥ 20 dan MariaDB/MySQL berjalan di `127.0.0.1:3306`

## Setup & Menjalankan
```bash
# 1. Install dependensi (root, server, client)
npm install
npm install --prefix server
npm install --prefix client

# 2. Setup database (membuat DB, user, skema, seed)
#    Konfigurasi admin DB via env DB_ADMIN_USER / DB_ADMIN_PASSWORD (default root tanpa password)
npm run setup:db

# 3. Jalankan API + client sekaligus (development)
npm run dev
```
- API: http://localhost:3001 (health: `/api/health`)
- Web: http://localhost:5173

## Akun Default (seed)
| Role   | Email             | Password  |
|--------|-------------------|-----------|
| Admin  | admin@kasir.test  | admin123  |
| Kasir  | kasir@kasir.test  | kasir123  |

## Test
```bash
npm test --prefix server
```

## Struktur
- `server/` — Express API, schema SQL, seed, tes integrasi
- `client/` — React + Vite (login, dashboard, kasir, master data, pembelian, laporan)

## Aturan Bisnis yang Diimplementasikan
- Transaksi penjualan & pembelian dibungkus transaksi DB (`BEGIN…COMMIT/ROLLBACK`)
- Validasi stok memakai `SELECT … FOR UPDATE` (anti race condition)
- Setiap jual/beli mencatat `stock_mutations` (`qty_change` + `stock_after`)
- Format invoice: `INV-YYYYMMDD-XXX` / `PO-YYYYMMDD-XXX`
