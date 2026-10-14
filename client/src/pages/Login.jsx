import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, storeAuth } from '../api.js';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('Debug info: Cek di bawah untuk email terakhir');
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
        {error && <div className="alert alert-warning py-2 small">{error}</div>}
        <div className="alert alert-info py-2 small">
            User di Browser: {localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).email : 'Tidak ditemukan'}
        </div>
        <form onSubmit={submit}>
          <div className="mb-3">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="mb-3">
            <label className="form-label">Sandi</label>
            <div className="input-group">
              <input
                className="form-control"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan sandi"
                required
              />
              <button
                type="button"
                className="btn btn-outline-secondary"
                tabIndex="-1"
                onClick={() => setShowPassword((v) => !v)}
              >
                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
              </button>
            </div>
          </div>
          <button className="btn btn-success w-100" disabled={loading}>
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}
