import { useEffect, useState } from 'react';
import { api } from '../api.js';

function MasterList({ endpoint, placeholder, items, setItems, setError }) {
  const [name, setName] = useState('');

  async function add(e) {
    e.preventDefault();
    try {
      await api(endpoint, { method: 'POST', body: { name } });
      setName('');
      setItems(await api(endpoint));
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(item) {
    if (!confirm(`Hapus "${item.name}"?`)) return;
    try {
      await api(`${endpoint}/${item.id}`, { method: 'DELETE' });
      setItems(await api(endpoint));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card pos-card">
      <div className="card-body p-3">
        <form className="d-flex gap-2 mb-3" onSubmit={add}>
          <input className="form-control" placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} required />
          <button className="btn btn-success text-nowrap">Tambah</button>
        </form>
        <div className="d-flex flex-column gap-2">
          {items.map((item) => (
            <div key={item.id} className="d-flex justify-content-between align-items-center border rounded-2 px-3 py-2">
              <span>{item.name}</span>
              <button className="btn btn-sm btn-outline-danger" onClick={() => remove(item)}>
                <i className="bi bi-trash" />
              </button>
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
        <MasterList endpoint="/categories" placeholder="Nama kategori (mis. Sarung Jok)" items={categories} setItems={setCategories} setError={setError} />
      )}
      {tab === 'type' && (
        <MasterList endpoint="/types" placeholder="Nama type (mis. Beat, Vario, NMAX)" items={types} setItems={setTypes} setError={setError} />
      )}
      {tab === 'model' && (
        <MasterList endpoint="/models" placeholder="Nama model (mis. Vario 125)" items={models} setItems={setModels} setError={setError} />
      )}
    </div>
  );
}
