export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function pad3(n) {
  return String(n).padStart(3, '0');
}

export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}${m}${d}`;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatLocalDate(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function formatLocalDateTime(date = new Date()) {
  return `${formatLocalDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

export function buildInvoiceNo(type, seq, date = new Date()) {
  const prefix = type === 'PO' ? 'PO' : 'INV';
  return `${prefix}-${localDateKey(date)}-${pad3(seq)}`;
}

export async function nextInvoiceNumber(conn, type, date = new Date()) {
  const prefix = type === 'PO' ? 'PO' : 'INV';
  const key = localDateKey(date);
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS total FROM ${type === 'PO' ? 'purchase_orders' : 'sales'} WHERE invoice_no LIKE ?`,
    [`${prefix}-${key}-%`]
  );
  return buildInvoiceNo(type, rows[0].total + 1, date);
}
