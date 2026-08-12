import { useEffect, useMemo, useState } from 'react';
import { api, rupiah, receiptUrl } from '../api.js';
import { digitsOnly, moneyInput } from '../format.js';

export default function Kasir() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [todayInfo, setTodayInfo] = useState(null);

  useEffect(() => {
    api('/products').then(setProducts).catch((e) => setError(e.message));
    api('/dashboard').then(setTodayInfo).catch(() => {});
  }, []);

  function priceOf(p) {
    return Number(p.selling_price);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, search]);

  function addToCart(p) {
    setCart((prev) => {
      const found = prev.find((i) => i.product_id === p.id);
      if (found) {
        if (found.qty >= p.current_stock) {
          setError(`Stok tidak mencukupi (Sisa: ${p.current_stock})`);
          return prev;
        }
        return prev.map((i) => (i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i));
      }
      if (p.current_stock < 1) {
        setError(`Stok tidak mencukupi (Sisa: 0)`);
        return prev;
      }
      setError('');
      return [...prev, { product_id: p.id, name: p.name, sku: p.sku, displayPrice: priceOf(p), chargePrice: Number(p.purchase_price), sellPrice: Number(p.selling_price), buyPrice: Number(p.purchase_price), stock: p.current_stock, qty: 1 }];
    });
  }

  function changeQty(productId, delta) {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.product_id !== productId) return i;
          const next = i.qty + delta;
          if (next > i.stock) {
            setError(`Stok tidak mencukupi (Sisa: ${i.stock})`);
            return i;
          }
          return { ...i, qty: next };
        })
        .filter((i) => i.qty > 0)
    );
  }

  function removeItem(productId) {
    setCart((prev) => prev.filter((i) => i.product_id !== productId));
  }

  const subtotal = cart.reduce((s, i) => s + i.qty * i.chargePrice, 0);
  const labaTotal = cart.reduce((s, i) => s + i.qty * (i.sellPrice - i.buyPrice), 0);
  const grandTotal = Math.max(0, subtotal - Number(discount || 0));
  const change = Number(paid || 0) - grandTotal;

  async function checkout() {
    setBusy(true);
    setError('');
    try {
      const sale = await api('/sales', {
        method: 'POST',
        body: {
          discount: Number(discount || 0),
          paid_amount: Number(paid || 0),
          items: cart.map((i) => ({ product_id: i.product_id, qty: i.qty, price: i.chargePrice })),
        },
      });
      setSuccess(sale);
      setCart([]);
      setDiscount(0);
      setPaid('');
      const fresh = await api('/products');
      setProducts(fresh);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row g-3" style={{ minHeight: '80vh' }}>
      <div className="col-12 col-lg-8">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="mb-0">Kasir</h4>
          {todayInfo && (
            <div className="small text-success fw-semibold">
              Hari Ini: {todayInfo.todayTransactions} transaksi · {rupiah(todayInfo.todayRevenue)}
            </div>
          )}
        </div>
        <input
          className="form-control form-control-lg mb-4 mt-2"
          placeholder="Cari produk / scan SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="row g-3 pos-products-scroll">
          {filtered.map((p) => (
            <div className="col-6 col-md-4 col-xl-3" key={p.id}>
              <div className="card pos-card card-product cur-pointer" onClick={() => addToCart(p)}>
                <div className="card-body p-3">
                  {p.image && (
                    <img
                      src={p.image}
                      alt={p.name}
                      className="rounded mb-1 border d-block mx-auto"
                      style={{ maxWidth: '100%', maxHeight: 96, height: 'auto' }}
                    />
                  )}
                  <div className="fw-semibold text-truncate">{p.name}</div>
                  <div className="small text-muted">{p.model ? `(${p.type ? p.type + ' ' : ''}${p.model})` : ''} {p.sku} · sisa {p.current_stock}</div>
                  <div className="text-success fw-bold">{rupiah(p.selling_price)}</div>
                  <div className="small text-warning">Laba {rupiah(Number(p.selling_price) - Number(p.purchase_price))}</div>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-muted">Produk tidak ditemukan</div>}
        </div>
      </div>

      <div className="col-12 col-lg-4">
        <div className="card pos-card h-100 d-flex flex-column">
          <div className="card-header bg-white fw-semibold">Keranjang</div>
          <div className="card-body overflow-auto flex-grow-1">
            {cart.length === 0 && <div className="text-muted small">Belum ada item.</div>}
            {cart.map((i) => (
              <div key={i.product_id} className="d-flex justify-content-between align-items-center border-bottom py-2">
                <div>
                  <div className="small fw-semibold">{i.name}</div>
                  <div className="small text-muted">{rupiah(i.displayPrice)}</div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => changeQty(i.product_id, -1)}>-</button>
                  <span className="fw-bold">{i.qty}</span>
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => changeQty(i.product_id, 1)}>+</button>
                  <button className="btn btn-outline-danger btn-sm" onClick={() => removeItem(i.product_id)}>
                    <i className="bi bi-trash" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="card-footer bg-white">
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label small mb-1">Diskon</label>
                <input className="form-control form-control-sm" inputMode="numeric" placeholder="0" value={moneyInput(discount)} onChange={(e) => setDiscount(digitsOnly(e.target.value))} />
              </div>
              <div className="col-6">
                <label className="form-label small mb-1">Bayar</label>
                <input className="form-control form-control-sm" inputMode="numeric" placeholder="0" value={moneyInput(paid)} onChange={(e) => setPaid(digitsOnly(e.target.value))} />
              </div>
            </div>
            <div className="d-flex justify-content-between mt-2 small">
              <span>Subtotal</span><span>{rupiah(subtotal)}</span>
            </div>
            <div className="d-flex justify-content-between fw-bold fs-5">
              <span>Total</span><span>{rupiah(grandTotal)}</span>
            </div>
            <div className="d-flex justify-content-between small text-success">
              <span>Laba</span><span>{rupiah(labaTotal)}</span>
            </div>
            {paid !== '' && (
              <div className={`d-flex justify-content-between small ${change < 0 ? 'text-danger' : 'text-success'}`}>
                <span>Kembalian</span><span>{change < 0 ? `Kurang ${rupiah(-change)}` : rupiah(change)}</span>
              </div>
            )}
            {error && <div className="alert alert-danger py-1 mt-2 small">{error}</div>}
            <button className="btn btn-success w-100 mt-2" disabled={busy || cart.length === 0} onClick={checkout}>
              {busy ? 'Memproses...' : 'Proses Bayar'}
            </button>
          </div>
        </div>
      </div>

      {success && (
        <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Transaksi Berhasil</h5>
                <button className="btn-close" onClick={() => setSuccess(null)} />
              </div>
              <div className="modal-body">
                <p>Invoice: <strong>{success.invoice_no}</strong></p>
                <p>Total: <strong>{rupiah(success.grand_total)}</strong></p>
                <p>Kembalian: <strong>{rupiah(success.change_amount)}</strong></p>
                <a className="btn btn-outline-success" target="_blank" rel="noreferrer" href={receiptUrl(success.id)}>
                  <i className="bi bi-printer me-1" />Cetak Struk PDF
                </a>
              </div>
              <div className="modal-footer">
                <button className="btn btn-success" onClick={() => setSuccess(null)}>Selesai</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
