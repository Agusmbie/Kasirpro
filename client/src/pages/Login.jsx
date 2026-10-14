import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, storeAuth } from '../api.js';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [emailList, setEmailList] = useState('Loading...');

  useEffect(() => {
    api('/auth/cek-email', { auth: false })
      .then(res => {
        if (Array.isArray(res)) {
          setEmailList(res.map(u => u.email).join(', '));
        } else {
          setEmailList('Format data tidak dikenali');
        }
      })
      .catch((e) => setEmailList('Gagal memuat: ' + e.message));
  }, []);

  async function submit(e) {
    e.preventDefault();
    try {
      const data = await api('/login', { method: 'POST', body: { email, password }, auth: false });
      storeAuth(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-dark">
      <div className="card pos-card p-4 w-100" style={{ maxWidth: 380 }}>
        <h4 className="text-center mb-4">KasPro Debug</h4>
        <div className="alert alert-info py-2 small" style={{ wordBreak: 'break-all' }}>
          <strong>Email Terdaftar:</strong> {emailList}
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={submit}>
          <div className="mb-3">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="mb-3">
            <label className="form-label">Sandi</label>
            <input className="form-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-success w-100">Masuk</button>
        </form>
      </div>
    </div>
  );
}
