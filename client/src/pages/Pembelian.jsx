import { useEffect, useState } from 'react';
import { api, rupiah } from '../api.js';
import { digitsOnly, moneyInput, todayKey } from '../format.js';

export default function Pembelian() {
  const [pos, setPos] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(todayKey());
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState([{ product_id: '', qty: 1, price: '' }]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null);

  async function load() {
    try {
      const [p, s, sup] = await Promise.all([api('/products'), api('/purchase-orders'), api('/suppliers')]);
      setProducts(p); setPos(s); setSuppliers(sup);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  function changeRow(i, key, value) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }
  function pickProduct(i, productId) {
    const p = products.find((x) => x.id === Number(productId));
    changeRow(i, 'product_id', productId);
    if (p && !rows[i].price) changeRow(i, 'price', p.purchase_price);
  }

  async function startEdit(po) {
    try {
      const d = await api(`/purchase-orders/${po.id}`);
      setSupplierId(d.supplier_id ? String(d.supplier_id) : '');
      setDate(todayKey(new Date(d.transaction_date)));
      setNotes(d.notes || '');
      setRows(d.items.map((i) => ({ product_id: String(i.product_id), qty: String(i.qty), price: String(i.purchase_price) })));
      setEditId(po.id);
      setError('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setError(e.message); }
  }

  async function remove(po) {
    if (!confirm(`Hapus pembelian ${po.invoice_no}? Stok produk akan dikurangi kembali.`)) return;
    try {
      await api(`/purchase-orders/${po.id}`, { method: 'DELETE' });
      load();
    } catch (e) { alert(e.message); }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const items = rows.map((r) => ({ product_id: Number(r.product_id), qty: Number(r.qty), purchase_price: Number(r.price || 0) }));
      if (items.some((i) => !i.product_id || i.qty <= 0)) throw new Error('Pilih produk dan qty > 0 di setiap baris');
      if (editId) {
        await api(`/purchase-orders/${editId}`, {
          method: 'PUT',
          body: { supplier_id: supplierId ? Number(supplierId) : null, transaction_date: date, notes, items },
        });
      } else {
        await api('/purchase-orders', {
          method: 'POST',
          body: { supplier_id: supplierId ? Number(supplierId) : null, transaction_date: date, notes, items },
        });
      }
      setRows([{ product_id: '', qty: 1, price: '' }]);
      setNotes(''); setEditId(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h4 className="mb-3">Pembelian (Stok Masuk)</h4>
      {error && <div className="alert alert-danger py-2">{error}</div>}

      <form className="card pos-card p-3 mb-4" onSubmit={submit}>
        <div className="row g-2 mb-2">
          <div className="col-md-4">
            <label className="form-label small mb-1">Supplier</label>
            <select className="form-select" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">-</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-1">Tanggal</label>
            <input className="form-control" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="col-md-5">
            <label className="form-label small mb-1">Catatan</label>
            <input className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table align-middle">
            <thead><tr><th>Produk</th><th style={{ width: 110 }}>Qty</th><th style={{ width: 150 }}>Harga Beli</th><th style={{ width: 80 }}></th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    <select className="form-select" value={r.product_id} onChange={(e) => pickProduct(i, e.target.value)} required>
                      <option value="">Pilih produk...</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name} (stok {p.current_stock})</option>)}
                    </select>
                  </td>
                  <td><input className="form-control" inputMode="numeric" value={r.qty} onChange={(e) => changeRow(i, 'qty', digitsOnly(e.target.value))} /></td>
                  <td><input className="form-control" inputMode="numeric" placeholder="0" value={moneyInput(r.price)} onChange={(e) => changeRow(i, 'price', digitsOnly(e.target.value))} /></td>
                  <td>
                    {rows.length > 1 && (
                      <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>
                        <i className="bi bi-x-lg" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setRows([...rows, { product_id: '', qty: 1, price: '' }])}>
            <i className="bi bi-plus-lg me-1" />Tambah Baris
          </button>
          {editId && (
            <button type="button" className="btn btn-outline-secondary" onClick={() => { setEditId(null); setRows([{ product_id: '', qty: 1, price: '' }]); setNotes(''); }}>
              Batal
            </button>
          )}
          <button className="btn btn-success ms-auto" disabled={busy}>{busy ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Simpan Pembelian'}</button>
        </div>
      </form>

      <div className="card pos-card">
        <div className="card-header bg-white fw-semibold">Riwayat Pembelian</div>
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead><tr><th>Invoice</th><th>Supplier</th><th>Tanggal</th><th>Item</th><th>Total</th><th>Petugas</th><th className="text-end">Aksi</th></tr></thead>
            <tbody>
              {pos.map((po) => (
                <tr key={po.id}>
                  <td>{po.invoice_no}</td><td>{po.supplier_name || '-'}</td><td>{po.transaction_date}</td>
                  <td>{po.item_count}</td><td>{rupiah(po.total_amount)}</td><td>{po.user_name}</td>
                  <td className="text-end text-nowrap">
                    <button className="btn btn-sm btn-outline-primary me-1" title="Edit pembelian" onClick={() => startEdit(po)}><i className="bi bi-pencil" /></button>
                    <button className="btn btn-sm btn-outline-danger" title="Hapus pembelian" onClick={() => remove(po)}><i className="bi bi-trash" /></button>
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
