export function digitsOnly(v) {
  return String(v == null ? '' : v).replace(/\D/g, '');
}

export function moneyInput(v) {
  const d = digitsOnly(v);
  return d ? Number(d).toLocaleString('id-ID') : '';
}

export function todayKey(date = new Date()) {
  return date.toLocaleDateString('en-CA');
}
