import { useEffect, useState } from 'react';
import { api } from '../api.js';

const empty = { name: '', phone: '', address: '' };

export default function Supplier() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');

  async function load() { try { setItems(await api('/suppliers')); } catch (e) { setError(e.message); } }
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    try {
      if (editId) await api(`/suppliers/${editId}`, { method: 'PUT', body: form });
      else await api('/suppliers', { method: 'POST', body: form });
      setForm(empty); setEditId(null); load();
    } catch (err) { setError(err.message); }
  }

  async function remove(s) {
    if (!confirm(`Hapus supplier "${s.name}"?`)) return;
    try { await api(`/suppliers/${s.id}`, { method: 'DELETE' }); load(); } catch (e) { alert(e.message); }
  }

  return (
    <div>
      <h4 className="mb-3">Supplier</h4>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <form className="card pos-card p-3 mb-3" onSubmit={submit}>
        <div className="row g-2">
          <div className="col-md-4"><input className="form-control" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="col-md-3"><input className="form-control" placeholder="Telepon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="col-md-5"><input className="form-control" placeholder="Alamat" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        </div>
        <div className="mt-2 d-flex gap-2">
          <button className="btn btn-success">{editId ? 'Simpan' : 'Tambah'}</button>
          {editId && <button type="button" className="btn btn-outline-secondary" onClick={() => { setEditId(null); setForm(empty); }}>Batal</button>}
        </div>
      </form>
      <div className="card pos-card">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
          <thead><tr><th>Nama</th><th>Telepon</th><th>Alamat</th><th className="text-end">Aksi</th></tr></thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td><td>{s.phone || '-'}</td><td>{s.address || '-'}</td>
                <td className="text-end">
                  <button className="btn btn-sm btn-outline-primary me-1" onClick={() => { setEditId(s.id); setForm({ name: s.name, phone: s.phone || '', address: s.address || '' }); }}><i className="bi bi-pencil" /></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => remove(s)}><i className="bi bi-trash" /></button>
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
