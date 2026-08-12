import mysql from 'mysql2/promise';
import { dbConfig, dbName } from './config.js';

export function makePool(database) {
  return mysql.createPool(dbConfig(database));
}

export const pool = makePool(dbName());
