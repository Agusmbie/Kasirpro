import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function applySchema(conn) {
  const schema = await fs.readFile(path.join(__dirname, '../../sql/schema.sql'), 'utf8');
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await conn.query(stmt);
  }
}
