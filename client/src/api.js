const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function getToken() {
  return localStorage.getItem('kaspro_token');
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('kaspro_user') || 'null');
  } catch {
    return null;
  }
}

export function storeAuth(token, user) {
  localStorage.setItem('kaspro_token', token);
  localStorage.setItem('kaspro_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('kaspro_token');
  localStorage.removeItem('kaspro_user');
}

async function parseResponse(res) {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.blob();
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (auth && res.status === 401) {
    clearAuth();
    window.location.replace('/login');
  }
  return parseResponse(res);
}

export function receiptUrl(saleId) {
  const base = API_URL.replace(/\/api\/?$/, '');
  return `${base}/api/sales/${saleId}/receipt?token=${encodeURIComponent(getToken() || '')}`;
}

export function rupiah(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n || 0));
}
