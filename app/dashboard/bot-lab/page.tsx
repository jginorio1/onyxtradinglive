'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { toast, toastErr } from '@/lib/toast';

type Tab = 'market' | 'licencias' | 'vender';
const GOLD = 'var(--gold, #ffd45e)';
function money(cents: number) { return '$' + ((cents || 0) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }); }

export default function BotLabDashboard() {
  const { lang } = useLang();
  const es = lang === 'es';
  const [tab, setTab] = useState<Tab>('market');
  const [products, setProducts] = useState<any[]>([]);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [sell, setSell] = useState<any>(null);
  const [crypto, setCrypto] = useState<any>(null);     // pago USDT en curso
  const [editing, setEditing] = useState<any>(null);   // producto en edición

  async function loadMarket() { try { const r = await fetch('/api/botlab/products?limit=60'); const j = await r.json(); setProducts(j.products || []); } catch {} }
  async function loadLicenses() { try { const r = await fetch('/api/botlab/licenses'); const j = await r.json(); setLicenses(j.licenses || []); } catch {} }
  async function loadSell() { try { const r = await fetch('/api/botlab/sell'); const j = await r.json(); setSell(j); } catch {} }

  useEffect(() => {
    loadMarket(); loadLicenses(); loadSell();
    try {
      const sp = new URLSearchParams(window.location.search);
      const t = sp.get('tab'); if (t === 'vender' || t === 'licencias' || t === 'market') setTab(t as Tab);
      const bought = sp.get('bought');
      if (bought) {
        fetch('/api/botlab/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: bought }) })
          .then((r) => r.json()).then((j) => { if (j.ok) { toast(es ? '¡Robot activado!' : 'Robot activated!'); loadLicenses(); setTab('licencias'); } });
        window.history.replaceState({}, '', '/dashboard/bot-lab');
      }
    } catch {}
  }, []); // eslint-disable-line

  async function buy(p: any, method: 'card' | 'usdt') {
    try {
      const r = await fetch('/api/botlab/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: p.id, method }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'error');
      if (j.url) { window.location.href = j.url; return; }
      if (j.crypto) setCrypto({ ...j.crypto, product: p });
    } catch (e: any) { toastErr(e?.message || 'error'); }
  }

  const wrap: any = { maxWidth: 1080, margin: '0 auto' };
  const card: any = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 16 };
  const tabBtn = (t: Tab, label: string) => (
    <button onClick={() => setTab(t)} style={{ padding: '9px 16px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', border: '1px solid ' + (tab === t ? 'var(--brand)' : 'var(--line)'), background: tab === t ? 'color-mix(in srgb,var(--brand) 16%,transparent)' : 'transparent', color: tab === t ? 'var(--brand)' : 'var(--tx)' }}>{label}</button>
  );

  return (
    <div style={{ ...wrap, padding: '10px 4px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Onyx Bot Lab</h1>
        <a href="/bot-lab" target="_blank" className="muted" style={{ fontSize: 13, marginLeft: 'auto' }}>{es ? 'Ver página pública ↗' : 'View public page ↗'}</a>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabBtn('market', es ? 'Marketplace' : 'Marketplace')}
        {tabBtn('licencias', es ? 'Mis robots' : 'My robots')}
        {tabBtn('vender', es ? 'Vender y ganar' : 'Sell & earn')}
      </div>

      {/* MARKETPLACE */}
      {tab === 'market' && (
        <div>
          {!products.length && <div style={{ ...card, textAlign: 'center', color: 'var(--mut)' }}>{es ? 'Aún no hay robots publicados. Vuelve pronto o publica el tuyo.' : 'No robots published yet. Check back soon or publish yours.'}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 14 }}>
            {products.map((p) => {
              const owned = licenses.some((l) => l.product_id === p.id && l.status === 'active');
              return (
                <div key={p.id} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(120deg,var(--brand),var(--brand2,#a06bff))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{(p.name || '?').slice(0, 1)}</div>
                    <div style={{ minWidth: 0 }}><div style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.1 }}>{p.name}</div><div className="muted" style={{ fontSize: 11.5 }}>{p.seller_name}{p.verified ? ' · ✓' : ''}</div></div>
                  </div>
                  {p.tagline && <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 8px' }}>{p.tagline}</p>}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {p.perf?.score != null && <span style={{ fontSize: 11, fontWeight: 800, color: GOLD, border: `1px solid color-mix(in srgb,${GOLD} 35%,transparent)`, padding: '2px 7px', borderRadius: 7 }}>Score {p.perf.score}</span>}
                    {p.platform && p.platform !== 'any' && <span className="muted" style={{ fontSize: 11, border: '1px solid var(--line)', padding: '2px 7px', borderRadius: 7 }}>{String(p.platform).toUpperCase()}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                    <b style={{ fontSize: 18 }}>{money(p.price_cents)}</b><span className="muted" style={{ fontSize: 12 }}>{p.kind === 'subscription' ? (es ? '/mes' : '/mo') : (es ? 'único' : 'once')}</span>
                  </div>
                  {owned ? (
                    <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: 'var(--green)', padding: 8, border: '1px solid color-mix(in srgb,var(--green) 35%,transparent)', borderRadius: 9 }}>✓ {es ? 'Ya es tuyo' : 'Owned'}</div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {p.accepts_card && <button onClick={() => buy(p, 'card')} style={{ flex: 1, padding: 9, borderRadius: 9, border: 'none', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', background: 'var(--brand)', color: '#0b1020' }}>💳 {es ? 'Tarjeta' : 'Card'}</button>}
                      {p.accepts_crypto && <button onClick={() => buy(p, 'usdt')} style={{ flex: 1, padding: 9, borderRadius: 9, cursor: 'pointer', fontWeight: 800, fontSize: 12.5, border: '1px solid color-mix(in srgb,var(--green) 40%,transparent)', background: 'color-mix(in srgb,var(--green) 10%,transparent)', color: 'var(--green)' }}>₮ USDT</button>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MIS LICENCIAS */}
      {tab === 'licencias' && (
        <div>
          {!licenses.length && <div style={{ ...card, textAlign: 'center', color: 'var(--mut)' }}>{es ? 'Aún no tienes robots. Explora el Marketplace.' : 'No robots yet. Browse the Marketplace.'}</div>}
          <div style={{ display: 'grid', gap: 10 }}>
            {licenses.map((l) => (
              <div key={l.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(120deg,var(--brand),var(--brand2,#a06bff))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{(l.product?.name || '?').slice(0, 1)}</div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 800 }}>{l.product?.name || (es ? 'Robot' : 'Robot')}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{l.method === 'usdt' ? 'USDT' : (es ? 'Tarjeta' : 'Card')} · {l.kind === 'subscription' ? (es ? 'suscripción' : 'subscription') : (es ? 'pago único' : 'one-time')}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 99, color: l.status === 'active' ? 'var(--green)' : 'var(--amber)', border: '1px solid ' + (l.status === 'active' ? 'color-mix(in srgb,var(--green) 40%,transparent)' : 'color-mix(in srgb,var(--amber) 40%,transparent)') }}>
                  {l.status === 'active' ? (es ? 'Activo' : 'Active') : l.status === 'pending' ? (es ? 'Pendiente' : 'Pending') : l.status}
                </span>
                <a href="/dashboard/constructor" className="muted" style={{ fontSize: 12.5, fontWeight: 700 }}>{es ? 'Descargar / instalar →' : 'Download / install →'}</a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VENDER */}
      {tab === 'vender' && sell && (
        <SellPanel es={es} sell={sell} reload={loadSell} onEdit={setEditing} />
      )}

      {/* MODAL: pago USDT */}
      {crypto && <CryptoModal es={es} crypto={crypto} onClose={() => setCrypto(null)} onDone={() => { setCrypto(null); toast(es ? 'Recibido. Activamos tu robot al confirmar el pago.' : 'Received. Your robot activates once the payment is confirmed.'); loadLicenses(); }} />}
      {/* MODAL: editar/crear producto */}
      {editing && <ProductModal es={es} product={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); loadSell(); }} />}
    </div>
  );
}

// ---------------------------------------------------------------- Vender
function SellPanel({ es, sell, reload, onEdit }: any) {
  const e = sell.earnings || {}; const connect = sell.connect || {};
  const card: any = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 16 };
  async function connectPay() {
    try { const r = await fetch('/api/botlab/sell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'connect' }) }); const j = await r.json(); if (j.url) window.location.href = j.url; else toastErr(j.error || 'error'); } catch (er: any) { toastErr(er?.message); }
  }
  async function payout() {
    try { const r = await fetch('/api/botlab/sell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'payout', method: 'stripe' }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); toast(es ? 'Retiro solicitado.' : 'Payout requested.'); reload(); } catch (er: any) { toastErr(er?.message); }
  }
  async function del(id: string) {
    try { await fetch('/api/botlab/sell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) }); reload(); } catch {}
  }
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
        {[[es ? 'Disponible' : 'Available', money(e.availableCents || 0), 'var(--green)'], [es ? 'Ventas' : 'Sales', String(e.sales || 0), 'var(--tx)'], [es ? 'Bruto' : 'Gross', money(e.grossCents || 0), 'var(--tx)'], [es ? 'Pagado' : 'Paid', money(e.paidCents || 0), 'var(--mut)']].map(([l, v, c], i) => (
          <div key={i} style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14 }}><div className="muted" style={{ fontSize: 12 }}>{l}</div><div style={{ fontSize: 22, fontWeight: 800, color: c as string }}>{v}</div></div>
        ))}
      </div>

      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <b>{es ? 'Cobro' : 'Payouts'}</b>
          <div className="muted" style={{ fontSize: 13 }}>{connect.chargesEnabled ? (es ? '✓ Listo para recibir pagos' : '✓ Ready to receive payments') : (es ? 'Conecta tu cobro para vender con tarjeta.' : 'Connect your payouts to sell by card.')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!connect.chargesEnabled && <button onClick={connectPay} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', fontWeight: 800, cursor: 'pointer', background: 'var(--brand)', color: '#0b1020' }}>{es ? 'Conectar cobro' : 'Connect payouts'}</button>}
          {(e.availableCents || 0) >= 1000 && <button onClick={payout} style={{ padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, border: '1px solid var(--line)', background: 'transparent', color: 'var(--tx)' }}>{es ? 'Retirar' : 'Withdraw'}</button>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>{es ? 'Mis robots a la venta' : 'My robots for sale'}</h3>
        <button onClick={() => onEdit({})} style={{ padding: '9px 15px', borderRadius: 10, border: 'none', fontWeight: 800, cursor: 'pointer', background: `linear-gradient(120deg,${GOLD},#ffb020)`, color: '#3a2a06' }}>+ {es ? 'Publicar robot' : 'Publish robot'}</button>
      </div>
      {!(sell.products || []).length && <div style={{ ...card, textAlign: 'center', color: 'var(--mut)' }}>{es ? 'Aún no publicas ningún robot.' : "You haven't published any robot yet."}</div>}
      <div style={{ display: 'grid', gap: 10 }}>
        {(sell.products || []).map((p: any) => (
          <div key={p.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}><b>{p.name}</b><div className="muted" style={{ fontSize: 12 }}>{money(p.price_cents)}{p.kind === 'subscription' ? (es ? '/mes' : '/mo') : ''} · {p.sales || 0} {es ? 'ventas' : 'sales'}</div></div>
            <span style={{ fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 99, border: '1px solid var(--line)', color: p.status === 'active' ? 'var(--green)' : p.status === 'pending' ? 'var(--amber)' : 'var(--mut)' }}>
              {p.status === 'active' ? (es ? 'Publicado' : 'Live') : p.status === 'pending' ? (es ? 'En revisión' : 'In review') : p.status === 'rejected' ? (es ? 'Rechazado' : 'Rejected') : (es ? 'Borrador' : 'Draft')}
            </span>
            <button onClick={() => onEdit(p)} className="muted" style={{ fontSize: 13, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>{es ? 'Editar' : 'Edit'}</button>
            <button onClick={() => del(p.id)} className="muted" style={{ fontSize: 13, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)' }}>{es ? 'Borrar' : 'Delete'}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Modal producto
function ProductModal({ es, product, onClose, onSaved }: any) {
  const [f, setF] = useState<any>({ name: '', tagline: '', kind: 'subscription', interval: 'month', price: 29, platform: 'mt5', category: '', accepts_card: true, accepts_crypto: true, ...product, price: product?.price_cents != null ? product.price_cents / 100 : (product?.price ?? 29) });
  const [saving, setSaving] = useState(false);
  const inp: any = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 14 };
  async function save() {
    if (!f.name?.trim()) { toastErr(es ? 'Ponle nombre a tu robot.' : 'Name your robot.'); return; }
    setSaving(true);
    try {
      const body = { action: 'save', product: { id: product?.id, name: f.name, tagline: f.tagline, description: f.description, kind: f.kind, interval: f.interval, price_cents: Math.round(Number(f.price) * 100), platform: f.platform, category: f.category, accepts_card: f.accepts_card, accepts_crypto: f.accepts_crypto } };
      const r = await fetch('/api/botlab/sell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      toast(es ? 'Enviado a revisión.' : 'Sent for review.'); onSaved();
    } catch (er: any) { toastErr(er?.message); } finally { setSaving(false); }
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: 22, width: 'min(520px,100%)' }}>
        <h3 style={{ marginTop: 0 }}>{product?.id ? (es ? 'Editar robot' : 'Edit robot') : (es ? 'Publicar robot' : 'Publish robot')}</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          <input style={inp} placeholder={es ? 'Nombre del robot' : 'Robot name'} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input style={inp} placeholder={es ? 'Frase corta (qué hace)' : 'Short tagline'} value={f.tagline || ''} onChange={(e) => setF({ ...f, tagline: e.target.value })} />
          <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} placeholder={es ? 'Descripción, estrategia, resultados…' : 'Description, strategy, results…'} value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <select style={inp} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="subscription">{es ? 'Renta mensual' : 'Monthly rental'}</option><option value="one_time">{es ? 'Pago único' : 'One-time'}</option></select>
            <select style={inp} value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })}><option value="mt5">MT5</option><option value="mt4">MT4</option><option value="ctrader">cTrader</option><option value="any">{es ? 'Cualquiera' : 'Any'}</option></select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="muted" style={{ fontSize: 14 }}>$</span><input type="number" style={inp} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
            <input style={inp} placeholder={es ? 'Categoría (scalping…)' : 'Category (scalping…)'} value={f.category || ''} onChange={(e) => setF({ ...f, category: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}><input type="checkbox" checked={f.accepts_card !== false} onChange={(e) => setF({ ...f, accepts_card: e.target.checked })} /> {es ? 'Acepta tarjeta' : 'Card'}</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}><input type="checkbox" checked={f.accepts_crypto !== false} onChange={(e) => setF({ ...f, accepts_crypto: e.target.checked })} /> {es ? 'Acepta USDT' : 'USDT'}</label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--line)', background: 'transparent', color: 'var(--tx)', cursor: 'pointer', fontWeight: 700 }}>{es ? 'Cancelar' : 'Cancel'}</button>
          <button onClick={save} disabled={saving} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', fontWeight: 800, cursor: 'pointer', background: 'var(--brand)', color: '#0b1020', opacity: saving ? .6 : 1 }}>{es ? 'Guardar y enviar' : 'Save & submit'}</button>
        </div>
        <p className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>{es ? 'Tu robot pasa por revisión antes de publicarse. Onyx retiene una comisión de cada venta.' : 'Your robot is reviewed before going live. Onyx keeps a commission per sale.'}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Modal USDT
function CryptoModal({ es, crypto, onClose, onDone }: any) {
  const [txid, setTxid] = useState('');
  const [sending, setSending] = useState(false);
  async function submit() {
    if (!txid.trim()) { toastErr(es ? 'Pega el hash de tu transacción.' : 'Paste your transaction hash.'); return; }
    setSending(true);
    try { const r = await fetch('/api/botlab/crypto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId: crypto.id, txid }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); onDone(); } catch (er: any) { toastErr(er?.message); } finally { setSending(false); }
  }
  const inp: any = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 13 };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: 22, width: 'min(440px,100%)' }}>
        <h3 style={{ marginTop: 0 }}>{es ? 'Pagar con USDT' : 'Pay with USDT'}</h3>
        <p className="muted" style={{ fontSize: 13 }}>{es ? 'Envía exactamente' : 'Send exactly'} <b style={{ color: 'var(--green)' }}>${crypto.amountUsd} USDT</b> {es ? 'a esta dirección' : 'to this address'} ({(crypto.network || 'trc20').toUpperCase()}):</p>
        {crypto.address ? (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: 12, wordBreak: 'break-all', fontSize: 13, fontFamily: 'monospace', margin: '4px 0 14px' }}>{crypto.address}</div>
        ) : (
          <div style={{ ...inp, color: 'var(--amber)', marginBottom: 14 }}>{es ? 'El administrador aún no configuró la wallet USDT.' : 'The admin has not set the USDT wallet yet.'}</div>
        )}
        <label className="muted" style={{ fontSize: 12.5 }}>{es ? 'Pega aquí el hash (txid) de tu envío' : 'Paste your transaction hash (txid)'}</label>
        <input style={{ ...inp, marginTop: 6 }} placeholder="0x… / trc20 hash" value={txid} onChange={(e) => setTxid(e.target.value)} />
        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--line)', background: 'transparent', color: 'var(--tx)', cursor: 'pointer', fontWeight: 700 }}>{es ? 'Cerrar' : 'Close'}</button>
          <button onClick={submit} disabled={sending} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', fontWeight: 800, cursor: 'pointer', background: 'var(--green)', color: '#04150e', opacity: sending ? .6 : 1 }}>{es ? 'Ya pagué' : 'I paid'}</button>
        </div>
        <p className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>{es ? 'Activamos tu robot en cuanto confirmemos el pago en la blockchain.' : 'Your robot activates as soon as we confirm the payment on-chain.'}</p>
      </div>
    </div>
  );
}
