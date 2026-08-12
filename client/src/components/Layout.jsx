import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getStoredUser, clearAuth } from '../api.js';

const links = [
  { to: '/dashboard', icon: 'bi-speedometer2', label: 'Dashboard' },
  { to: '/kasir', icon: 'bi-cash-coin', label: 'Kasir' },
  { to: '/barang', icon: 'bi-box-seam', label: 'Barang' },
  { to: '/pembelian', icon: 'bi-box-arrow-in-down', label: 'Pembelian', admin: true },
  { to: '/transaksi', icon: 'bi-receipt', label: 'Transaksi' },
  { to: '/kategori', icon: 'bi-tags', label: 'Master Data', admin: true },
  { to: '/supplier', icon: 'bi-truck', label: 'Supplier', admin: true },
  { to: '/pengguna', icon: 'bi-people', label: 'Pengguna', admin: true },
  { to: '/laporan', icon: 'bi-file-earmark-bar-graph', label: 'Laporan', admin: true },
];

export default function Layout() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [open, setOpen] = useState(false);
  const visible = links.filter((l) => !l.admin || user?.role === 'admin');

  function logout() {
    clearAuth();
    navigate('/login');
  }

  return (
    <div className="min-vh-100">
      <nav className="navbar navbar-dark bg-dark px-3">
        <button
          className="btn btn-outline-light"
          aria-label="Buka menu"
          onClick={() => setOpen(true)}
        >
          <i className="bi bi-list fs-4" />
        </button>
        <span className="navbar-brand mb-0 ms-2 d-flex flex-column align-items-start lh-1">
          <span><i className="bi bi-shop me-2" />KasPro</span>
          <small className="text-white-50 fw-normal fs-6">Bunian Jok Style</small>
        </span>
        <div className="ms-auto">
          <span className="text-white-50 small d-none d-md-inline">
            {user?.name} ({user?.role})
          </span>
        </div>
      </nav>

      {open && <div className="drawer-backdrop" onClick={() => setOpen(false)} />}
      <aside className={`drawer ${open ? 'drawer-open' : ''}`}>
        <div className="drawer-header">
          <div className="d-flex flex-column align-items-start lh-1">
            <h5 className="mb-0"><i className="bi bi-shop me-2" />KasPro</h5>
            <small className="text-muted">Bunian Jok Style</small>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <ul className="nav flex-column gap-1 p-2">
          {visible.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `nav-link rounded-2 ${isActive ? 'bg-success text-white' : 'text-dark'}`
                }
              >
                <i className={`bi ${l.icon} me-2`} />{l.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="drawer-footer">
          <div className="small text-muted mb-2">{user?.name} ({user?.role})</div>
          <button className="btn btn-outline-danger btn-sm w-100" onClick={logout}>
            <i className="bi bi-box-arrow-right me-1" />Keluar
          </button>
        </div>
      </aside>

      <main className="p-3 p-md-4">
        <Outlet />
      </main>
    </div>
  );
}
