import { useEffect, useState } from 'react';
import { api, rupiah } from '../api.js';
import { moneyInput, digitsOnly } from '../format.js';

function MasterList({ endpoint, placeholder, items, setItems, setError, hasPrice = false }) {
  const [name, setName] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [editId, setEditId] = useState(null);

  async function load() {
    try {
      setItems(await api(endpoint));
    } catch (e) {
      setError(e.message);
    }
  }

  async function submit(e) {
    e.preventDefault();
    try {
      const body = { 
        name, 
        purchase_price: Number(digitsOnly(purchasePrice) || 0), 
        selling_price: Number(digitsOnly(sellingPrice) || 0) 
      };
      if (editId) {
        await api(`${endpoint}/${editId}`, { method: 'PUT', body });
      } else {
        await api(endpoint, { method: 'POST', body });
      }
      setName('');
      setPurchasePrice('');
      setSellingPrice('');
      setEditId(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(item) {
    setEditId(item.id);
    setName(item.name);
    setPurchasePrice(moneyInput(item.purchase_price || 0));
    setSellingPrice(moneyInput(item.selling_price || 0));
  }

  function cancelEdit() {
    setEditId(null);
    setName('');
    setPurchasePrice('');
    setSellingPrice('');
  }

  async function remove(item) {
    if (!confirm(`Hapus "${item.name}"?`)) return;
    try {
      await api(`${endpoint}/${item.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card pos-card">
      <div className="card-body p-3">
        <form className="mb-3" onSubmit={submit}>
          <div className="row g-2">
            <div className="col-md-4">
              <input className="form-control" placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            {hasPrice && (
              <>
                <div className="col-md-3">
                  <input className="form-control" placeholder="Harga Beli" inputMode="numeric" value={purchasePrice} onChange={(e) => setPurchasePrice(moneyInput(e.target.value))} />
                </div>
                <div className="col-md-3">
                  <input className="form-control" placeholder="Harga Jual" inputMode="numeric" value={sellingPrice} onChange={(e) => setSellingPrice(moneyInput(e.target.value))} />
                </div>
              </>
            )}
            <div className="col-md-2 d-flex align-items-end">
              <button className="btn btn-success w-100" type="submit">{editId ? 'Simpan' : 'Tambah'}</button>
            </div>
            {editId && (
              <div className="col-md-1 d-flex align-items-end">
                <button type="button" className="btn btn-outline-secondary w-100" onClick={cancelEdit}>Batal</button>
              </div>
            )}
          </div>
        </form>
        <div className="d-flex flex-column gap-2">
          {items.map((item) => (
            <div key={item.id} className="d-flex justify-content-between align-items-center border rounded-2 px-3 py-2">
              <div className="d-flex align-items-center gap-3 flex-wrap">
                <span className="fw-medium">{item.name}</span>
                {hasPrice && (
                  <>
                    <span className="text-muted small">Beli: {rupiah(item.purchase_price || 0)}</span>
                    <span className="text-success small">Jual: {rupiah(item.selling_price || 0)}</span>
                  </>
                )}
              </div>
              <div className="d-flex gap-1">
                <button className="btn btn-sm btn-outline-primary" onClick={() => startEdit(item)}><i className="bi bi-pencil" /></button>
                <button className="btn btn-sm btn-outline-danger" onClick={() => remove(item)}><i className="bi bi-trash" /></button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="text-muted text-center py-3">Belum ada data. Tambahkan dulu di atas.</div>}
        </div>
      </div>
    </div>
  );
}

export default function Kategori() {
  const [tab, setTab] = useState('kategori');
  const [categories, setCategories] = useState([]);
  const [types, setTypes] = useState([]);
  const [models, setModels] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/categories').then(setCategories).catch((e) => setError(e.message));
    api('/types').then(setTypes).catch((e) => setError(e.message));
    api('/models').then(setModels).catch((e) => setError(e.message));
  }, []);

  const tabs = [
    { key: 'kategori', label: 'Kategori' },
    { key: 'type', label: 'Type' },
    { key: 'model', label: 'Model' },
  ];

  return (
    <div>
      <h4 className="mb-3">Master Data</h4>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <ul className="nav nav-tabs mb-3">
        {tabs.map((t) => (
          <li className="nav-item" key={t.key}>
            <button className={`nav-link ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          </li>
        ))}
      </ul>

      {tab === 'kategori' && (
        <MasterList endpoint="/categories" placeholder="Nama kategori (mis. Sarung Jok)" items={categories} setItems={setCategories} setError={setError} hasPrice={false} />
      )}
      {tab === 'type' && (
        <MasterList endpoint="/types" placeholder="Nama type (mis. Beat, Vario, NMAX)" items={types} setItems={setTypes} setError={setError} hasPrice={true} />
      )}
      {tab === 'model' && (
        <MasterList endpoint="/models" placeholder="Nama model (mis. Vario 125)" items={models} setItems={setModels} setError={setError} hasPrice={true} />
      )}
    </div>
  );
}
