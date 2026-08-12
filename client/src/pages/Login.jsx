import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, storeAuth } from '../api.js';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@kasir.test');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api('/login', { method: 'POST', body: { email, password }, auth: false });
      storeAuth(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-dark">
      <div className="card pos-card p-4 w-100" style={{ maxWidth: 380 }}>
        <h4 className="text-center mb-1"><i className="bi bi-shop me-2" />KasPro</h4>
        <p className="text-center text-muted small mb-4">Kasir & Manajemen Stok</p>
        {error && <div className="alert alert-danger py-2">{error}</div>}
        <form onSubmit={submit}>
          <div className="mb-3">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="mb-3">
            <label className="form-label">Password</label>
            <input className="form-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-success w-100" disabled={loading}>
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}
