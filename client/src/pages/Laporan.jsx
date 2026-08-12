import { useEffect, useState } from 'react';
import { api, rupiah } from '../api.js';

function formatDaily(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('id-ID');
}
function formatWeekly(start) {
  const a = new Date(start + 'T00:00:00');
  const b = new Date(a);
  b.setDate(b.getDate() + 6);
  const f = (d) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  return `${f(a)} – ${f(b)} ${a.getFullYear()}`;
}
function formatMonthly(month) {
  return new Date(month + '-01T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

const PERIOD_TABS = [
  { key: 'harian', label: 'Laporan Harian', fmt: formatDaily },
  { key: 'mingguan', label: 'Laporan Mingguan', fmt: formatWeekly },
  { key: 'bulanan', label: 'Laporan Bulanan', fmt: formatMonthly },
];

export default function Laporan() {
  const [tab, setTab] = useState('mutasi');
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [mutations, setMutations] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [periodData, setPeriodData] = useState({ harian: [], mingguan: [], bulanan: [] });
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  async function loadMutations() {
    try {
      const params = new URLSearchParams();
      if (productId) params.set('product_id', productId);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      setMutations(await api(`/stock-mutations?${params.toString()}`));
    } catch (e) { setError(e.message); }
  }

  useEffect(() => {
    api('/products').then(setProducts).catch((e) => setError(e.message));
    loadMutations();
  }, []);

  useEffect(() => {
    if (tab === 'stok') {
      api('/products').then(setStocks).catch((e) => setError(e.message));
    }
    if (PERIOD_TABS.some((t) => t.key === tab)) {
      api(`/reports/${tab}`).then((d) => setPeriodData((p) => ({ ...p, [tab]: d }))).catch((e) => setError(e.message));
    }
  }, [tab]);

  async function exportExcel() {
    const params = new URLSearchParams();
    if (productId) params.set('product_id', productId);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    const blob = await api(`/stock-mutations/export?${params.toString()}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mutasi-stok.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function removeMutation(m) {
    const label = m.reference_type === 'sale' ? 'hapus transaksi (stok dikembalikan)' : 'hapus catatan mutasi ini';
    if (!confirm(`Yakin ingin ${label}?`)) return;
    try {
      if (m.reference_type === 'sale') {
        await api(`/sales/${m.reference_id}`, { method: 'DELETE' });
      } else {
        await api(`/stock-mutations/${m.id}`, { method: 'DELETE' });
      }
      loadMutations();
    } catch (e) {
      alert(e.message);
    }
  }

  async function openDetail(type, key) {
    const tabDef = PERIOD_TABS.find((t) => t.key === type);
    try {
      const res = await api(`/reports/${type}/${key}`);
      setDetail({ label: tabDef.fmt(key), items: res.sales, totals: res.totals });
    } catch (e) {
      setError(e.message);
    }
  }

  function todayKey() {
    return new Date().toLocaleDateString('en-CA');
  }

  return (
    <div>
      <h4 className="mb-3">Laporan</h4>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item"><button className={`nav-link ${tab === 'mutasi' ? 'active' : ''}`} onClick={() => setTab('mutasi')}>Mutasi Stok</button></li>
        <li className="nav-item"><button className={`nav-link ${tab === 'stok' ? 'active' : ''}`} onClick={() => setTab('stok')}>Stok Saat Ini</button></li>
        {PERIOD_TABS.map((t) => (
          <li className="nav-item" key={t.key}>
            <button className={`nav-link ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          </li>
        ))}
      </ul>

      {tab === 'mutasi' && (
        <>
          <div className="card pos-card p-3 mb-3">
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <label className="form-label small mb-1">Produk</label>
                <select className="form-select" value={productId} onChange={(e) => { setProductId(e.target.value); }}>
                  <option value="">Semua</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-1">Dari</label>
                <input className="form-control" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-1">Sampai</label>
                <input className="form-control" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div className="col-md-4 d-flex gap-2">
                <button className="btn btn-success" onClick={loadMutations}><i className="bi bi-funnel me-1" />Filter</button>
                <button className="btn btn-outline-success" onClick={exportExcel}><i className="bi bi-file-earmark-excel me-1" />Export Excel</button>
              </div>
            </div>
          </div>

          <div className="card pos-card">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead><tr><th>Tanggal</th><th>SKU</th><th>Produk</th><th>Tipe</th><th>Qty</th><th>Stok Akhir</th><th>Keterangan</th><th className="text-end">Aksi</th></tr></thead>
                <tbody>
                  {mutations.map((m) => (
                    <tr key={m.id}>
                      <td>{new Date(m.created_at).toLocaleString('id-ID')}</td>
                      <td>{m.sku}</td><td>{m.product_name}</td>
                      <td><span className={`badge ${m.qty_change > 0 ? 'bg-success' : 'bg-danger'}`}>{m.reference_type}</span></td>
                      <td className={m.qty_change > 0 ? 'text-success fw-bold' : 'text-danger fw-bold'}>{m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change}</td>
                      <td>{m.stock_after}</td><td className="small text-muted">{m.description}</td>
                      <td className="text-end">
                        {m.reference_type !== 'purchase' && (
                          <button className="btn btn-sm btn-outline-danger" title={m.reference_type === 'sale' ? 'Hapus transaksi (stok dikembalikan)' : 'Hapus catatan'} onClick={() => removeMutation(m)}>
                            <i className="bi bi-trash" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {mutations.length === 0 && <tr><td colSpan="8" className="text-center text-muted">Belum ada data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'stok' && (
        <div className="card pos-card">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead><tr><th>SKU</th><th>Nama</th><th>Kategori</th><th>Harga Beli</th><th>Harga Jual</th><th>Stok</th></tr></thead>
              <tbody>
                {stocks.map((p) => (
                  <tr key={p.id}>
                    <td>{p.sku}</td><td>{p.name}</td><td>{p.category_name || '-'}</td>
                    <td>{rupiah(p.purchase_price)}</td><td>{rupiah(p.selling_price)}</td>
                    <td><span className={`badge ${p.current_stock < 10 ? 'bg-danger' : 'bg-success'}`}>{p.current_stock}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {PERIOD_TABS.map((t) => tab === t.key && (
        (() => {
          const rows = t.key === 'harian' && !periodData.harian.some((r) => r.period === todayKey())
            ? [{ period: todayKey(), transaction_count: 0, item_count: 0, total: 0, cost_total: 0, revenue_total: 0, profit_total: 0 }, ...periodData[t.key]]
            : periodData[t.key];
          return (
            <div className="card pos-card print-area" key={t.key}>
              <div className="card-header bg-white d-flex justify-content-between align-items-center">
                <span className="fw-semibold">{t.label} (otomatis tersimpan)</span>
                <button className="btn btn-sm btn-outline-success" onClick={() => window.print()}>
                  <i className="bi bi-printer me-1" />Cetak
                </button>
              </div>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead><tr><th>Periode</th><th className="text-end">Transaksi</th><th className="text-end">Item</th><th className="text-end">Harga Beli</th><th className="text-end">Harga Jual</th><th className="text-end">Laba</th><th className="text-end">Total</th><th className="text-end">Aksi</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.period}>
                        <td>{t.fmt(r.period)}</td>
                        <td className="text-end">{r.transaction_count}</td>
                        <td className="text-end">{r.item_count}</td>
                        <td className="text-end">{rupiah(r.cost_total)}</td>
                        <td className="text-end">{rupiah(r.revenue_total)}</td>
                        <td className={`text-end fw-bold ${Number(r.profit_total) < 0 ? 'text-danger' : 'text-success'}`}>{rupiah(r.profit_total)}</td>
                        <td className="text-end">{rupiah(r.total)}</td>
                        <td className="text-end">
                          <button className="btn btn-sm btn-outline-primary" onClick={() => openDetail(t.key, r.period)}>Detail</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()
      ))}

      {detail && (
        <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,.5)' }}>
          <div className="modal-dialog modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Detail {detail.label}</h5>
                <button className="btn-close" onClick={() => setDetail(null)} />
              </div>
              <div className="modal-body">
                <div className="row g-2 mb-3">
                  <div className="col-6"><div className="border rounded-3 p-2"><div className="small text-muted">Harga Beli</div><div className="fw-bold">{rupiah(detail.totals.cost_total)}</div></div></div>
                  <div className="col-6"><div className="border rounded-3 p-2"><div className="small text-muted">Harga Jual</div><div className="fw-bold">{rupiah(detail.totals.revenue_total)}</div></div></div>
                  <div className="col-6"><div className="border rounded-3 p-2"><div className="small text-muted">Laba</div><div className="fw-bold text-success">{rupiah(detail.totals.profit_total)}</div></div></div>
                  <div className="col-6"><div className="border rounded-3 p-2"><div className="small text-muted">Total</div><div className="fw-bold">{rupiah(detail.totals.total)}</div></div></div>
                </div>
                {detail.items.length === 0 && <div className="text-muted">Tidak ada transaksi</div>}
                {detail.items.map((s) => (
                  <div key={s.id} className="d-flex justify-content-between border-bottom py-2">
                    <div>
                      <div className="small fw-semibold">{s.invoice_no}</div>
                      <div className="small text-muted">{new Date(s.transaction_date).toLocaleTimeString('id-ID')} · {s.customer_name} · {s.user_name}</div>
                    </div>
                    <div className="fw-bold">{rupiah(s.grand_total)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
