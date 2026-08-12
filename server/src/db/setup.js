import mysql from 'mysql2/promise';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dbConfig, dbName, dbNameTest } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const admin = {
    host: process.env.DB_ADMIN_HOST || process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_ADMIN_USER || 'root',
    password: process.env.DB_ADMIN_PASSWORD || '',
  };
  const conn = await mysql.createConnection(admin);
  console.log('Terhubung sebagai admin DB');

  const user = process.env.DB_USER || 'pos_user';
  const pass = process.env.DB_PASSWORD || 'pos_password';
  const databases = [dbName(), dbNameTest()];

  for (const db of databases) {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`Database siap: ${db}`);
  }

  await conn.query(`CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?`, [user, pass]);
  await conn.query(`CREATE USER IF NOT EXISTS ?@'localhost' IDENTIFIED BY ?`, [user, pass]);
  for (const db of databases) {
    await conn.query(`GRANT ALL PRIVILEGES ON \`${db}\`.* TO ?@'%'`, [user]);
    await conn.query(`GRANT ALL PRIVILEGES ON \`${db}\`.* TO ?@'localhost'`, [user]);
  }
  await conn.query('FLUSH PRIVILEGES');
  console.log(`User DB dibuat/diperbarui: ${user}`);

  const { applySchema } = await import('./schema.js');
  for (const db of databases) {
    const c = await mysql.createConnection(dbConfig(db));
    await applySchema(c);
    await c.end();
    console.log(`Skema diterapkan: ${db}`);
  }

  await conn.end();

  const { seed } = await import('./seed.js');
  await seed({ test: false });
  console.log('Setup database selesai.');
}

main().catch((e) => {
  console.error('Setup gagal:', e);
  process.exit(1);
});
