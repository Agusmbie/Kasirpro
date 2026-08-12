import { Routes, Route, Navigate } from 'react-router-dom';
import { getToken, getStoredUser } from './api.js';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Kasir from './pages/Kasir.jsx';
import Barang from './pages/Barang.jsx';
import Kategori from './pages/Kategori.jsx';
import Pembelian from './pages/Pembelian.jsx';
import Supplier from './pages/Supplier.jsx';
import Transaksi from './pages/Transaksi.jsx';
import Pengguna from './pages/Pengguna.jsx';
import Laporan from './pages/Laporan.jsx';

function RequireAuth({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const user = getStoredUser();
  if (!getToken()) return <Navigate to="/login" replace />;
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/kasir" element={<Kasir />} />
        <Route path="/transaksi" element={<Transaksi />} />
        <Route path="/barang" element={<Barang />} />
        <Route path="/kategori" element={<RequireAdmin><Kategori /></RequireAdmin>} />
        <Route path="/pembelian" element={<RequireAdmin><Pembelian /></RequireAdmin>} />
        <Route path="/supplier" element={<RequireAdmin><Supplier /></RequireAdmin>} />
        <Route path="/pengguna" element={<RequireAdmin><Pengguna /></RequireAdmin>} />
        <Route path="/laporan" element={<RequireAdmin><Laporan /></RequireAdmin>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
