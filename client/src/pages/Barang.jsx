import { useEffect, useState } from 'react';
import { api, rupiah, getStoredUser } from '../api.js';
import { digitsOnly, moneyInput } from '../format.js';
import { fileToDataUrl } from '../image.js';

const empty = { sku: '', name: '', type: '', model: '', category_id: '', unit: 'pcs', purchase_price: '', selling_price: '', initial_stock: '', image: '' };

export default function Barang() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [types, setTypes] = useState([]);
  const [models, setModels] = useState([]);
  const [q, setQ] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [skuTouched, setSkuTouched] = useState(false);
  const isAdmin = getStoredUser()?.role === 'admin';

  async function load() {
    try {
      const [prod, cat, t, m] = await Promise.all([api('/products'), api('/categories'), api('/types'), api('/models')]);
      setItems(prod);
      setCategories(cat);
      setTypes(t);
      setModels(m);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => { load(); }, []);

  function makeAutoSku(name) {
    const clean = name.trim().toUpperCase();
    if (!clean) return '';
    const words = clean.split(/\s+/).filter(Boolean);
    let base = words.length === 1 ? words[0].slice(0, 3) : words.slice(0, 3).map((w) => w[0]).join('');
    base = base.replace(/[^A-Z0-9]/g, '');
    if (!base) base = 'SKU';
    const used = new Set(items.map((p) => p.sku.toUpperCase()));
    if (!used.has(base)) return base;
    let n = 2;
    while (used.has(`${base}${n}`)) n++;
    return `${base}${n}`;
  }

  function categoryPrefix(name) {
    return (name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'SKU';
  }

  function makeSkuFromCategory(categoryId) {
    const cat = categories.find((c) => c.id === Number(categoryId));
    const prefix = categoryPrefix(cat?.name);
    const nums = items
      .filter((p) => p.sku.toUpperCase().startsWith(prefix + '-'))
      .map((p) => parseInt(p.sku.slice(prefix.length + 1), 10))
      .filter((n) => Number.isInteger(n) && n > 0);
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `${prefix}-${String(next).padStart(3, '0')}`;
  }

  function openNew() { setEditId(null); setForm(empty); setError(''); setSkuTouched(false); setShow(true); }
  function openEdit(p) {
    setEditId(p.id);
    setForm({ sku: p.sku, name: p.name, type: p.type || '', model: p.model || '', category_id: p.category_id || '', unit: p.unit, purchase_price: p.purchase_price, selling_price: p.selling_price, initial_stock: '', image: p.image || '' });
    setError('');
    setShow(true);
  }

  async function onImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('File harus gambar'); return; }
    try {
      const dataUrl = await fileToDataUrl(file, 200);
      setForm((f) => ({ ...f, image: dataUrl }));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    const payload = {
      sku: form.sku,
      name: form.name,
      type: form.type,
      model: form.model,
      category_id: form.category_id || null,
      image: form.image || null,
      unit: form.unit || 'pcs',
      purchase_price: Number(form.purchase_price || 0),
      selling_price: Number(form.selling_price || 0),
      initial_stock: Number(form.initial_stock || 0),
    };
    try {
      if (editId) {
        await api(`/products/${editId}`, { method: 'PUT', body: payload });
      } else {
        await api('/products', { method: 'POST', body: payload });
      }
      setShow(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(p) {
    if (!confirm(`Hapus produk "${p.name}"?`)) return;
    try { await api(`/products/${p.id}`, { method: 'DELETE' }); load(); } catch (e) { alert(e.message); }
  }

  const filtered = items.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Barang</h4>
        {isAdmin && <button className="btn btn-success" onClick={openNew}><i className="bi bi-plus-lg me-1" />Tambah</button>}
      </div>
      <input className="form-control mb-3" placeholder="Cari nama / SKU" value={q} onChange={(e) => setQ(e.target.value)} />
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {/* Mobile: kartu (tanpa scroll/slider) */}
      <div className="d-md-none d-flex flex-column gap-2">
        {filtered.map((p) => (
          <div className="card pos-card" key={p.id}>
            <div className="card-body p-3">
              <div className="d-flex gap-3">
                {p.image && <img src={p.image} alt={p.name} className="rounded border" style={{ width: 56, height: 56, objectFit: 'cover' }} />}
                <div className="flex-grow-1">
                  <div className="fw-semibold">{p.name}</div>
                  <div className="small text-muted">{p.sku} · {p.category_name || '-'}</div>
                  <div className="small text-muted">{(p.type ? p.type + (p.model ? ' — ' + p.model : '') : (p.model || '')) || '-'}</div>
                </div>
                <span className={`fw-bold ${p.current_stock < 10 ? 'text-danger' : 'text-success'}`}>Stok {p.current_stock}</span>
              </div>
              <div className="d-flex justify-content-between mt-2 small">
                <span className="text-muted">Beli {rupiah(p.purchase_price)}</span>
                <span className="fw-bold text-success">Jual {rupiah(p.selling_price)}</span>
              </div>
              {isAdmin && (
                <div className="text-end mt-2">
                  <button className="btn btn-sm btn-outline-primary me-1" onClick={() => openEdit(p)}><i className="bi bi-pencil" /></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => remove(p)}><i className="bi bi-trash" /></button>
                </div>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-muted text-center py-4">Produk tidak ditemukan</div>}
      </div>

      {/* Desktop: tabel */}
      <div className="card pos-card d-none d-md-block">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead><tr><th>SKU</th><th>Nama</th><th>Type</th><th>Model</th><th>Kategori</th><th>Harga Beli</th><th>Harga Jual</th><th>Stok</th>{isAdmin && <th className="text-end">Aksi</th>}</tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.image && <img src={p.image} alt={p.name} className="rounded me-2" style={{ width: 32, height: 32, objectFit: 'cover' }} />}
                    {p.sku}
                  </td>
                  <td>{p.name}</td><td>{p.type || '-'}</td><td>{p.model || '-'}</td><td>{p.category_name || '-'}</td>
                  <td>{rupiah(p.purchase_price)}</td><td>{rupiah(p.selling_price)}</td>
                  <td><span className={`fw-bold ${p.current_stock < 10 ? 'text-danger' : 'text-success'}`}>{p.current_stock}</span></td>
                  {isAdmin && (
                    <td className="text-end text-nowrap">
                          <button className="btn btn-sm btn-outline-primary me-1" onClick={() => openEdit(p)}><i className="bi bi-pencil" /></button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => remove(p)}><i className="bi bi-trash" /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {show && (
        <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,.5)' }}>
          <div className="modal-dialog modal-dialog-scrollable">
            <div className="modal-content">
              <form onSubmit={submit}>
                <div className="modal-header">
                  <h5 className="modal-title">{editId ? 'Edit Barang' : 'Tambah Barang'}</h5>
                  <button type="button" className="btn-close" onClick={() => setShow(false)} />
                </div>
                <div className="modal-body">
                  {error && <div className="alert alert-danger py-2">{error}</div>}
                  <div className="d-flex align-items-center gap-3 mb-3">
                    {form.image ? (
                      <img src={form.image} alt="preview" className="rounded border" style={{ width: 64, height: 64, objectFit: 'cover' }} />
                    ) : (
                      <div className="rounded border d-flex align-items-center justify-content-center text-muted" style={{ width: 64, height: 64 }}>no img</div>
                    )}
                    <div>
                      <label className="btn btn-sm btn-outline-secondary mb-1">
                        <i className="bi bi-upload me-1" />Upload Gambar
                        <input type="file" accept="image/*" className="d-none" onChange={onImageChange} />
                      </label>
                      {form.image && (
                        <button type="button" className="btn btn-sm btn-outline-danger ms-1" onClick={() => setForm((f) => ({ ...f, image: '' }))}>
                          <i className="bi bi-x-lg" />
                        </button>
                      )}
                      <div className="form-text">Kecil (±200px), opsional.</div>
                    </div>
                  </div>
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small">SKU</label>
                      <input className="form-control" required value={form.sku} onChange={(e) => { setSkuTouched(true); setForm({ ...form, sku: e.target.value }); }} />
                    </div>
                    <div className="col-6">
                      <label className="form-label small">Nama</label>
                      <input className="form-control" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, sku: !editId && !skuTouched ? (f.category_id ? f.sku : makeAutoSku(e.target.value)) : f.sku }))} />
                    </div>
                    <div className="col-6">
                      <label className="form-label small">Type</label>
                      <select
                        className="form-select"
                        value={form.type && types.some((t) => t.name === form.type) ? form.type : form.type ? '__other__' : ''}
                        onChange={(e) => setForm((f) => ({ ...f, type: e.target.value === '__other__' ? f.type : e.target.value }))}
                      >
                        <option value="">Pilih type...</option>
                        {types.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                        {form.type && !types.some((t) => t.name === form.type) && <option value="__other__">Lainnya (isi manual)</option>}
                      </select>
                      {form.type && !types.some((t) => t.name === form.type) && (
                        <input className="form-control mt-2" placeholder="Tulis type..." value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
                      )}
                    </div>
                    <div className="col-6">
                      <label className="form-label small">Model</label>
                      <select
                        className="form-select"
                        value={form.model && models.some((m) => m.name === form.model) ? form.model : form.model ? '__other__' : ''}
                        onChange={(e) => setForm((f) => ({ ...f, model: e.target.value === '__other__' ? f.model : e.target.value }))}
                      >
                        <option value="">Pilih model...</option>
                        {models.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                        {form.model && !models.some((m) => m.name === form.model) && <option value="__other__">Lainnya (isi manual)</option>}
                      </select>
                      {form.model && !models.some((m) => m.name === form.model) && (
                        <input className="form-control mt-2" placeholder="Tulis model..." value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
                      )}
                    </div>
                    <div className="col-6">
                      <label className="form-label small">Kategori</label>
                      <select className="form-select" value={form.category_id} onChange={(e) => {
                        const val = e.target.value;
                        setForm((f) => ({ ...f, category_id: val, sku: !editId && !skuTouched && val ? makeSkuFromCategory(val) : f.sku }));
                      }}>
                        <option value="">-</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small">Satuan</label>
                      <input className="form-control" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                    </div>
                    <div className="col-6">
                      <label className="form-label small">Harga Beli</label>
                      <input className="form-control" inputMode="numeric" placeholder="0" value={moneyInput(form.purchase_price)} onChange={(e) => setForm({ ...form, purchase_price: digitsOnly(e.target.value) })} />
                    </div>
                    <div className="col-6">
                      <label className="form-label small">Harga Jual</label>
                      <input className="form-control" inputMode="numeric" placeholder="0" value={moneyInput(form.selling_price)} onChange={(e) => setForm({ ...form, selling_price: digitsOnly(e.target.value) })} />
                    </div>
                    {!editId && (
                      <div className="col-12">
                        <label className="form-label small">Stok Awal</label>
                        <input className="form-control" inputMode="numeric" placeholder="0" value={moneyInput(form.initial_stock)} onChange={(e) => setForm({ ...form, initial_stock: digitsOnly(e.target.value) })} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShow(false)}>Batal</button>
                  <button type="submit" className="btn btn-success">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
