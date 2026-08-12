import { useEffect, useState } from 'react';
import { api, rupiah } from '../api.js';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/dashboard').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!data) return <p>Memuat...</p>;

  const cards = [
    { label: 'Pendapatan Hari Ini', value: rupiah(data.todayRevenue), icon: 'bi-cash-stack', color: 'bg-success' },
    { label: 'Laba Hari Ini', value: rupiah(data.todayProfit), icon: 'bi-graph-up-arrow', color: 'bg-warning text-dark' },
    { label: 'Total Transaksi Hari Ini', value: data.todayTransactions, icon: 'bi-receipt', color: 'bg-primary' },
    { label: 'Total Produk', value: data.totalProducts, icon: 'bi-box-seam', color: 'bg-info' },
  ];

  return (
    <div>
      <h4>Dashboard</h4>
      <div className="row g-3 mt-1">
        {cards.map((c) => (
          <div className="col-6 col-md-3" key={c.label}>
            <div className="card pos-card">
              <div className="card-body d-flex align-items-center gap-3">
                <div className={`rounded-3 text-white d-flex align-items-center justify-content-center ${c.color}`} style={{ width: 56, height: 56 }}>
                  <i className={`bi ${c.icon} fs-4`} />
                </div>
                <div>
                  <div className="text-muted small">{c.label}</div>
                  <div className="fs-5 fw-bold">{c.value}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card pos-card mt-4">
        <div className="card-header bg-white fw-semibold">Produk Stok Menipis (&lt; 10)</div>
        <div className="card-body p-0">
          <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead><tr><th>SKU</th><th>Nama</th><th>Stok</th></tr></thead>
            <tbody>
              {data.lowStockProducts.length === 0 && (
                <tr><td colSpan="3" className="text-muted text-center">Tidak ada stok menipis</td></tr>
              )}
              {data.lowStockProducts.map((p) => (
                <tr key={p.id}><td>{p.sku}</td><td>{p.name}</td><td><span className="badge bg-danger">{p.current_stock}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </div>
  );
}
