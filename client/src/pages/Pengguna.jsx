import { useEffect, useState } from 'react';
import { api } from '../api.js';

const empty = { name: '', email: '', password: '', role: 'kasir' };

export default function Pengguna() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');

  async function load() { try { setItems(await api('/users')); } catch (e) { setError(e.message); } }
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    if (!editId && !form.password) { setError('Password wajib diisi untuk user baru'); return; }
    try {
      if (editId) {
        const body = { name: form.name, email: form.email, role: form.role };
        if (form.password) body.password = form.password;
        await api(`/users/${editId}`, { method: 'PUT', body });
      } else {
        await api('/users', { method: 'POST', body: form });
      }
      setForm(empty); setEditId(null); load();
    } catch (err) { setError(err.message); }
  }

  async function remove(u) {
    if (!confirm(`Hapus user "${u.name}"?`)) return;
    try { await api(`/users/${u.id}`, { method: 'DELETE' }); load(); } catch (e) { alert(e.message); }
  }

  return (
    <div>
      <h4 className="mb-3">Pengguna</h4>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <form className="card pos-card p-3 mb-3" onSubmit={submit}>
        <div className="row g-2">
          <div className="col-md-3"><input className="form-control" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="col-md-3"><input className="form-control" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div className="col-md-3"><input className="form-control" type="password" placeholder={editId ? 'Password (opsional)' : 'Password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div className="col-md-3">
            <select className="form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="cashier">Kasir</option><option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="mt-2 d-flex gap-2">
          <button className="btn btn-success">{editId ? 'Simpan' : 'Tambah'}</button>
          {editId && <button type="button" className="btn btn-outline-secondary" onClick={() => { setEditId(null); setForm(empty); }}>Batal</button>}
        </div>
      </form>
      <div className="card pos-card">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
          <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th className="text-end">Aksi</th></tr></thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td><td>{u.email}</td>
                <td><span className={`badge ${u.role === 'admin' ? 'bg-primary' : 'bg-secondary'}`}>{u.role}</span></td>
                <td className="text-end">
                  <button className="btn btn-sm btn-outline-primary me-1" onClick={() => { setEditId(u.id); setForm({ name: u.name, email: u.email, password: '', role: u.role }); }}><i className="bi bi-pencil" /></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => remove(u)}><i className="bi bi-trash" /></button>
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
