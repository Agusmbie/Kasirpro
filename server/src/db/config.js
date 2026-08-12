import 'dotenv/config';

export function dbConfig(database) {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'pos_user',
    password: process.env.DB_PASSWORD || 'pos_password',
    database,
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,
    ...(process.env.DB_SSL === '1' ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

export const dbName = () => process.env.DB_NAME || 'pos_inventory';
export const dbNameTest = () => process.env.DB_NAME_TEST || 'pos_inventory_test';
