import { useEffect, useState } from 'react';
import { api, rupiah, receiptUrl } from '../api.js';

export default function Transaksi() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  async function load() {
    try { setItems(await api('/sales')); } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  function fmtDate(d) {
    return new Date(d).toLocaleString('id-ID');
  }

  return (
    <div className="pt-3">
      <h4 className="mb-3">Transaksi</h4>
      {error && <div className="alert alert-danger py-2">{error}</div>}

      {items.length === 0 && !error && <div className="text-muted text-center py-4">Belum ada transaksi</div>}

      {/* Mobile: kartu */}
      <div className="d-md-none d-flex flex-column gap-2">
        {items.map((s) => (
          <div className="card pos-card" key={s.id}>
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <div className="fw-semibold">{s.invoice_no}</div>
                  <div className="small text-muted">{fmtDate(s.transaction_date)}</div>
                </div>
                <span className="fw-bold text-success">{rupiah(s.grand_total)}</span>
              </div>
              <div className="small mt-2">
                <div>Pelanggan: {s.customer_name || 'Umum'}</div>
                <div>Kasir: {s.user_name || '-'}</div>
                <div>Bayar {rupiah(s.paid_amount)} · Kembali {rupiah(s.change_amount)}</div>
              </div>
              <div className="text-end mt-2">
                <a className="btn btn-sm btn-outline-success" target="_blank" rel="noreferrer" href={receiptUrl(s.id)}>
                  <i className="bi bi-printer me-1" />Struk
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: tabel */}
      <div className="card pos-card d-none d-md-block">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead><tr><th>Invoice</th><th>Waktu</th><th>Pelanggan</th><th>Kasir</th><th className="text-end">Total</th><th className="text-end">Bayar</th><th className="text-end">Kembalian</th><th></th></tr></thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td>{s.invoice_no}</td>
                  <td>{fmtDate(s.transaction_date)}</td>
                  <td>{s.customer_name || 'Umum'}</td>
                  <td>{s.user_name || '-'}</td>
                  <td className="text-end fw-bold">{rupiah(s.grand_total)}</td>
                  <td className="text-end">{rupiah(s.paid_amount)}</td>
                  <td className="text-end">{rupiah(s.change_amount)}</td>
                  <td className="text-end">
                    <a className="btn btn-sm btn-outline-success" target="_blank" rel="noreferrer" href={receiptUrl(s.id)}>
                      <i className="bi bi-printer" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
