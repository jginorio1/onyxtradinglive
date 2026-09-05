'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { toast, toastErr } from '@/lib/toast';

type View = 'market' | 'licencias' | 'vender' | 'ganancias';
const GOLD = 'var(--gold, #ffd45e)';
function money(cents: number) { return '$' + ((cents || 0) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
const card: any = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 16 };

export default function BotLabDashboard() {
  const { lang } = useLang();
  const es = lang === 'es';
  const [view, setView] = useState<View>('market');
  const [products, setProducts] = useState<any[]>([]);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [sell, setSell] = useState<any>(null);
  const [crypto, setCrypto] = useState<any>(null);
  const [netPick, setNetPick] = useState<any>(null); // { product, networks } elegir red USDT
  const [editing, setEditing] = useState<any>(null);

  async function loadMarket() { try { const r = await fetch('/api/botlab/products?limit=60'); const j = await r.json(); setProducts(j.products || []); } catch {} }
  async function loadLicenses() { try { const r = await fetch('/api/botlab/licenses'); const j = await r.json(); setLicenses(j.licenses || []); } catch {} }
  async function loadSell() { try { const r = await fetch('/api/botlab/sell'); const j = await r.json(); setSell(j); } catch {} }

  useEffect(() => {
    loadMarket(); loadLicenses(); loadSell();
    try {
      const sp = new URLSearchParams(window.location.search);
      const t = sp.get('tab'); if (t === 'vender' || t === 'licencias' || t === 'market' || t === 'ganancias') setView(t as View);
      // Viene del constructor con "Vender este robot": abre el formulario ya prellenado.
      if (sp.get('new') === '1') {
        setView('vender');
        setEditing({
          name: sp.get('name') || '', platform: sp.get('platform') || 'mt5',
          tagline: sp.get('tagline') || '', description: sp.get('desc') || '',
          kind: 'subscription', interval: 'month', price: 29, category: sp.get('category') || '',
          bot_magic: sp.get('magic') || '', bot_account: sp.get('account') || '',
          accepts_card: true, accepts_crypto: true,
        });
        window.history.replaceState({}, '', '/dashboard/bot-lab?tab=vender');
      }
      const bought = sp.get('bought');
      if (bought) {
        fetch('/api/botlab/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: bought }) })
          .then((r) => r.json()).then((j) => { if (j.ok) { toast(es ? '¡Robot activado!' : 'Robot activated!'); loadLicenses(); setView('licencias'); } });
        window.history.replaceState({}, '', '/dashboard/bot-lab');
      }
    } catch {}
  }, []); // eslint-disable-line

  async function buy(p: any, method: 'card' | 'usdt', network?: string) {
    try {
      const r = await fetch('/api/botlab/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: p.id, method, network }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'error');
      if (j.chooseNetwork) { setNetPick({ product: p, networks: j.chooseNetwork }); return; } // el cliente elige red
      if (j.url) { window.location.href = j.url; return; }
      if (j.crypto) { setNetPick(null); setCrypto({ ...j.crypto, product: p }); }
    } catch (e: any) { toastErr(e?.message || 'error'); }
  }

  const svg = (d: string) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
  const NAV: [View, JSX.Element, string][] = [
    ['market', svg('M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0'), es ? 'Marketplace' : 'Marketplace'],
    ['licencias', svg('M12 3l7 9-7 9-7-9z'), es ? 'Mis robots' : 'My robots'],
    ['vender', svg('M3 3v18h18M7 14l4-4 3 3 5-6'), es ? 'Vender' : 'Sell'],
    ['ganancias', svg('M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'), es ? 'Ganancias' : 'Earnings'],
  ];

  return (
    <div className="bl-shell" style={{ maxWidth: 1120, margin: '0 auto', padding: '10px 4px 60px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {/* Barra lateral propia */}
      <aside className="bl-side" style={{ flex: '0 0 210px', position: 'sticky', top: 78 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 8px 14px' }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(120deg,${GOLD},#ffb020)`, color: '#3a2a06', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>◆</span>
          <b style={{ fontSize: 15 }}>Bot Lab</b>
        </div>
        <nav className="bl-nav" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV.map(([k, ic, lbl]) => (
            <button key={k} onClick={() => setView(k)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left', width: '100%', border: 'none', background: view === k ? 'color-mix(in srgb,var(--brand) 16%,transparent)' : 'transparent', color: view === k ? 'var(--brand)' : 'var(--tx)' }}>
              <span style={{ display: 'inline-flex' }}>{ic}</span>{lbl}
            </button>
          ))}
        </nav>
        <a href="/bot-lab" target="_blank" className="muted" style={{ display: 'block', padding: '12px 12px 0', fontSize: 12.5 }}>{es ? 'Página pública ↗' : 'Public page ↗'}</a>
      </aside>

      {/* Contenido */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {view === 'market' && (
          <div>
            {!products.length && <div style={{ ...card, textAlign: 'center', color: 'var(--mut)' }}>{es ? 'Aún no hay robots publicados. Vuelve pronto o publica el tuyo.' : 'No robots published yet. Check back soon or publish yours.'}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 14 }}>
              {products.map((p) => {
                const owned = licenses.some((l) => l.product_id === p.id && l.status === 'active');
                return (
                  <div key={p.id} style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(120deg,var(--brand),var(--brand2,#a06bff))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{(p.name || '?').slice(0, 1)}</div>
                      <div style={{ minWidth: 0 }}><div style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.1 }}>{p.name}</div><div className="muted" style={{ fontSize: 11.5 }}>{p.seller_name}</div></div>
                    </div>
                    {/* Sello de verificación con track record REAL medido por Onyx */}
                    {p.verified && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: GOLD, background: `color-mix(in srgb,${GOLD} 12%,transparent)`, border: `1px solid color-mix(in srgb,${GOLD} 45%,transparent)`, padding: '3px 9px', borderRadius: 99, marginBottom: 8 }}>◆ {es ? 'Verificado por Onyx' : 'Verified by Onyx'}{p.perf?.score != null ? ` · ${p.perf.score}` : ''}</div>
                    )}
                    {p.tagline && <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 8px' }}>{p.tagline}</p>}
                    {/* Mini track record real (si está ligado a un robot con operaciones) */}
                    {p.perf?.trades != null && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5, marginBottom: 10 }}>
                        {[[es ? 'Aciertos' : 'Win', (p.perf.winrate ?? 0) + '%'], ['Profit factor', p.perf.pf ?? '—'], ['Drawdown', (p.perf.dd ?? 0) + '%']].map(([k, v]: any) => (
                          <div key={k} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '5px 4px', textAlign: 'center' }}>
                            <div style={{ fontSize: 13, fontWeight: 800 }}>{v}</div><div className="muted" style={{ fontSize: 9.5 }}>{k}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      {p.platform && p.platform !== 'any' && <span className="muted" style={{ fontSize: 11, border: '1px solid var(--line)', padding: '2px 7px', borderRadius: 7 }}>{String(p.platform).toUpperCase()}</span>}
                      {p.perf?.days != null && <span className="muted" style={{ fontSize: 11, border: '1px solid var(--line)', padding: '2px 7px', borderRadius: 7 }}>{p.perf.days} {es ? 'días' : 'days'}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                      <b style={{ fontSize: 18 }}>{money(p.price_cents)}</b><span className="muted" style={{ fontSize: 12 }}>{p.kind === 'subscription' ? (es ? '/mes' : '/mo') : (es ? 'único' : 'once')}</span>
                    </div>
                    {owned ? (
                      <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: 'var(--green)', padding: 8, border: '1px solid color-mix(in srgb,var(--green) 35%,transparent)', borderRadius: 9 }}>✓ {es ? 'Ya es tuyo' : 'Owned'}</div>
                    ) : (
                      <>
                        {/* USDT (Ethereum) DESTACADO: pago instantáneo y sin contracargos */}
                        <button onClick={() => buy(p, 'usdt')} style={{ width: '100%', padding: '13px 12px', borderRadius: 11, cursor: 'pointer', fontWeight: 800, fontSize: 14, border: 'none', background: 'linear-gradient(120deg,var(--green),#12b981)', color: '#04150e', boxShadow: '0 8px 22px color-mix(in srgb,var(--green) 32%,transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <span style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(4,21,14,.14)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>₮</span>
                          {es ? 'Pagar con USDT' : 'Pay with USDT'}
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 5 }}>
                          <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.04em', color: 'var(--green)', border: '1px solid color-mix(in srgb,var(--green) 35%,transparent)', borderRadius: 99, padding: '1px 7px' }}>◆ TRON · ETHEREUM</span>
                          <span className="muted" style={{ fontSize: 10 }}>{es ? 'sin contracargos' : 'no chargebacks'}</span>
                        </div>
                        <button onClick={() => buy(p, 'card')} className="muted" style={{ width: '100%', marginTop: 6, padding: '6px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 11.5, border: 'none', background: 'transparent' }}>{es ? 'o pagar con tarjeta' : 'or pay by card'}</button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === 'licencias' && (
          <div>
            {!licenses.length && <div style={{ ...card, textAlign: 'center', color: 'var(--mut)' }}>{es ? 'Aún no tienes robots. Explora el Marketplace.' : 'No robots yet. Browse the Marketplace.'}</div>}
            <div style={{ display: 'grid', gap: 10 }}>
              {licenses.map((l) => {
                // Estado real de la licencia: vigencia para las de renta.
                const endMs = l.current_period_end ? new Date(l.current_period_end).getTime() : 0;
                const days = endMs ? Math.ceil((endMs - Date.now()) / 86400000) : null;
                const expired = endMs > 0 && endMs < Date.now();
                const active = l.status === 'active' && !expired;
                const c = active ? 'var(--green)' : (l.status === 'pending' ? 'var(--amber)' : 'var(--red)');
                const label = l.status === 'pending' ? (es ? 'Pendiente' : 'Pending')
                  : expired || l.status === 'expired' ? (es ? 'Vencida' : 'Expired')
                  : l.status === 'past_due' ? (es ? 'Pago atrasado' : 'Past due')
                  : l.status === 'canceled' ? (es ? 'Cancelada' : 'Canceled')
                  : (es ? 'Activa' : 'Active');
                return (
                <div key={l.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderColor: active ? undefined : `color-mix(in srgb,${c} 35%,var(--line))` }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(120deg,var(--brand),var(--brand2,#a06bff))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{(l.product?.name || '?').slice(0, 1)}</div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 800 }}>{l.product?.name || (es ? 'Robot' : 'Robot')}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{l.method === 'usdt' ? 'USDT' : (es ? 'Tarjeta' : 'Card')} · {l.kind === 'subscription' ? (es ? 'renta mensual' : 'monthly') : (es ? 'pago único' : 'one-time')}{active && days != null && days >= 0 ? ` · ${es ? 'renueva en' : 'renews in'} ${days} ${es ? 'días' : 'days'}` : ''}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 99, color: c, border: `1px solid color-mix(in srgb,${c} 40%,transparent)` }}>
                    {active ? '✓ ' : ''}{label}
                  </span>
                  {active
                    ? <a href="/dashboard/constructor" className="muted" style={{ fontSize: 12.5, fontWeight: 700 }}>{es ? 'Descargar / instalar →' : 'Download / install →'}</a>
                    : l.kind === 'subscription' && l.product_id
                      ? <button onClick={() => { const p = products.find((x) => x.id === l.product_id); if (p) buy(p, 'usdt'); }} style={{ fontSize: 12.5, fontWeight: 800, cursor: 'pointer', border: '1px solid color-mix(in srgb,var(--green) 40%,transparent)', background: 'color-mix(in srgb,var(--green) 12%,transparent)', color: 'var(--green)', borderRadius: 9, padding: '6px 12px' }}>{es ? 'Renovar' : 'Renew'}</button>
                      : null}
                </div>
                );
              })}
            </div>
          </div>
        )}

        {view === 'vender' && sell && <SellPanel es={es} sell={sell} reload={loadSell} onEdit={setEditing} />}
        {view === 'ganancias' && sell && <EarningsPanel es={es} sell={sell} reload={loadSell} />}
      </div>

      {netPick && <NetworkPicker es={es} pick={netPick} onClose={() => setNetPick(null)} onPick={(n: string) => buy(netPick.product, 'usdt', n)} />}
      {crypto && <CryptoModal es={es} crypto={crypto} onClose={() => setCrypto(null)} onDone={() => { setCrypto(null); toast(es ? 'Recibido. Activamos tu robot al confirmar el pago.' : 'Received. Your robot activates once the payment is confirmed.'); loadLicenses(); }} />}
      {editing && <ProductModal es={es} product={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); loadSell(); }} />}

      <style>{`@media(max-width:820px){.bl-shell{flex-direction:column}.bl-side{position:static!important;flex:none!important;width:100%}.bl-nav{flex-direction:row!important;flex-wrap:wrap}}`}</style>
    </div>
  );
}

// ---------------------------------------------------------------- Vender
function SellPanel({ es, sell, reload, onEdit }: any) {
  const connect = sell.connect || {};
  async function connectPay() {
    try { const r = await fetch('/api/botlab/sell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'connect' }) }); const j = await r.json(); if (j.url) window.location.href = j.url; else toastErr(j.error || 'error'); } catch (er: any) { toastErr(er?.message); }
  }
  async function del(id: string) {
    try { await fetch('/api/botlab/sell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) }); reload(); } catch {}
  }
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <b>{es ? 'Cobro' : 'Payouts'}</b>
          <div className="muted" style={{ fontSize: 13 }}>{connect.chargesEnabled ? (es ? '✓ Listo para recibir pagos' : '✓ Ready to receive payments') : (es ? 'Conecta tu cobro para vender con tarjeta.' : 'Connect your payouts to sell by card.')}</div>
        </div>
        {!connect.chargesEnabled && <button onClick={connectPay} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', fontWeight: 800, cursor: 'pointer', background: 'var(--brand)', color: '#0b1020' }}>{es ? 'Conectar cobro' : 'Connect payouts'}</button>}
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

// ---------------------------------------------------------------- Ganancias
function EarningsPanel({ es, sell, reload }: any) {
  const e = sell.earnings || {};
  async function payout() {
    try { const r = await fetch('/api/botlab/sell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'payout', method: 'stripe' }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); toast(es ? 'Retiro solicitado.' : 'Payout requested.'); reload(); } catch (er: any) { toastErr(er?.message); }
  }
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
        {[[es ? 'Disponible' : 'Available', money(e.availableCents || 0), 'var(--green)'], [es ? 'Ventas' : 'Sales', String(e.sales || 0), 'var(--tx)'], [es ? 'Bruto' : 'Gross', money(e.grossCents || 0), 'var(--tx)'], [es ? 'Pagado' : 'Paid', money(e.paidCents || 0), 'var(--mut)']].map(([l, v, c], i) => (
          <div key={i} style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14 }}><div className="muted" style={{ fontSize: 12 }}>{l}</div><div style={{ fontSize: 22, fontWeight: 800, color: c as string }}>{v}</div></div>
        ))}
      </div>
      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div><b>{es ? 'Retirar tus ganancias' : 'Withdraw your earnings'}</b><div className="muted" style={{ fontSize: 13 }}>{es ? 'Desde $10 disponibles. Te pagamos a tu banco o en USDT.' : 'From $10 available. We pay to your bank or in USDT.'}</div></div>
        <button onClick={payout} disabled={(e.availableCents || 0) < 1000} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', fontWeight: 800, cursor: (e.availableCents || 0) < 1000 ? 'not-allowed' : 'pointer', opacity: (e.availableCents || 0) < 1000 ? .5 : 1, background: `linear-gradient(120deg,${GOLD},#ffb020)`, color: '#3a2a06' }}>{es ? 'Solicitar retiro' : 'Request payout'}</button>
      </div>
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>{es ? 'Historial de retiros' : 'Payout history'}</h3>
        {!(sell.payouts || []).length && <div className="muted" style={{ fontSize: 13 }}>{es ? 'Aún no has pedido retiros.' : 'No payouts requested yet.'}</div>}
        <div style={{ display: 'grid', gap: 8 }}>
          {(sell.payouts || []).map((p: any) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              <div style={{ flex: 1, minWidth: 140 }}><b>{money(p.amount_cents)}</b> <span className="muted" style={{ fontSize: 12 }}>· {p.method}</span></div>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: p.status === 'paid' ? 'var(--green)' : 'var(--amber)' }}>{p.status === 'paid' ? (es ? 'Pagado' : 'Paid') : (es ? 'En proceso' : 'Processing')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Chip de método de pago: seleccionable, con check claro (reemplaza los checkbox descuadrados).
function PayChip({ on, onClick, icon, label }: any) {
  return (
    <button type="button" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 11, cursor: 'pointer', textAlign: 'left', border: `1.5px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'color-mix(in srgb,var(--brand) 12%,transparent)' : 'var(--bg2)', color: 'var(--tx)' }}>
      <span style={{ width: 22, height: 22, flex: 'none', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, background: on ? 'var(--brand)' : 'transparent', color: on ? '#0b1020' : 'var(--mut)', border: on ? 'none' : '1.5px solid var(--line)' }}>{on ? '✓' : ''}</span>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontWeight: 700, fontSize: 13.5 }}>{label}</span>
    </button>
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
      const body = { action: 'save', product: { id: product?.id, name: f.name, tagline: f.tagline, description: f.description, kind: f.kind, interval: f.interval, price_cents: Math.round(Number(f.price) * 100), platform: f.platform, category: f.category, proof_url: f.proof_url, bot_magic: f.bot_magic || null, bot_account: f.bot_account || null, accepts_card: f.accepts_card, accepts_crypto: f.accepts_crypto } };
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
          <input style={inp} placeholder={es ? 'Prueba de rendimiento (Myfxbook, backtest, statement…)' : 'Performance proof (Myfxbook, backtest, statement…)'} value={f.proof_url || ''} onChange={(e) => setF({ ...f, proof_url: e.target.value })} />
          <span className="muted" style={{ fontSize: 11.5, marginTop: -4 }}>{es ? 'Un enlace a tu track record real ayuda a que aprobemos tu robot más rápido.' : 'A link to your real track record helps us approve your robot faster.'}</span>
          <div>
            <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>{es ? 'Métodos de pago que aceptas' : 'Payment methods you accept'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <PayChip on={f.accepts_card !== false} onClick={() => setF({ ...f, accepts_card: !(f.accepts_card !== false) })} icon="💳" label={es ? 'Tarjeta' : 'Card'} />
              <PayChip on={f.accepts_crypto !== false} onClick={() => setF({ ...f, accepts_crypto: !(f.accepts_crypto !== false) })} icon="₮" label="USDT" />
            </div>
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

// Nombre bonito de cada red USDT.
const NET_INFO: Record<string, { name: string; badge: string; hint_es: string; hint_en: string }> = {
  trc20: { name: 'TRON (TRC20)', badge: 'T…', hint_es: 'Comisión de red baja (centavos). Recomendada.', hint_en: 'Low network fee (cents). Recommended.' },
  erc20: { name: 'Ethereum (ERC20)', badge: '0x…', hint_es: 'Comisión de red más alta (gas).', hint_en: 'Higher network fee (gas).' },
};
// ---------------------------------------------------------------- Elegir red USDT (evita enviar por la red equivocada)
function NetworkPicker({ es, pick, onClose, onPick }: any) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(3,6,14,.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 22, width: 'min(400px,100%)' }}>
        <h3 style={{ margin: '0 0 4px' }}>{es ? '¿En qué red pagas?' : 'Which network?'}</h3>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>{es ? 'Elige la red de tu wallet. Debes enviar el USDT por ESA misma red.' : 'Pick your wallet\'s network. You must send USDT on THAT same network.'}</p>
        <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
          {/* TRON primero y recomendada (comisión de red baja). */}
          {([...(pick.networks as string[])].sort((a, b) => (a === 'trc20' ? -1 : b === 'trc20' ? 1 : 0))).map((n) => {
            const i = NET_INFO[n] || { name: n.toUpperCase(), badge: '', hint_es: '', hint_en: '' };
            const rec = n === 'trc20';
            return (
              <button key={n} onClick={() => onPick(n)} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 13, cursor: 'pointer', textAlign: 'left', border: `1.5px solid ${rec ? 'var(--green)' : 'var(--line)'}`, background: rec ? 'color-mix(in srgb,var(--green) 10%,var(--bg2))' : 'var(--bg2)', color: 'var(--tx)', boxShadow: rec ? '0 6px 18px color-mix(in srgb,var(--green) 20%,transparent)' : 'none' }}>
                <span style={{ width: 36, height: 36, flex: 'none', borderRadius: 10, background: 'linear-gradient(120deg,var(--green),#12b981)', color: '#04150e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>₮</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800, fontSize: 14.5 }}>{i.name}{rec && <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.04em', color: 'var(--green)', background: 'color-mix(in srgb,var(--green) 16%,transparent)', border: '1px solid color-mix(in srgb,var(--green) 40%,transparent)', borderRadius: 99, padding: '1px 7px' }}>{es ? 'RECOMENDADA' : 'RECOMMENDED'}</span>}</span>
                  <span className="muted" style={{ fontSize: 11.5 }}>{es ? i.hint_es : i.hint_en}</span>
                </span>
                <span style={{ color: rec ? 'var(--green)' : 'var(--mut)', fontSize: 18 }}>›</span>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--amber)', background: 'color-mix(in srgb,var(--amber) 10%,transparent)', border: '1px solid color-mix(in srgb,var(--amber) 35%,transparent)', borderRadius: 10, padding: '9px 11px' }}>
          ⚠ {es ? 'Enviar por la red equivocada pierde tus fondos. Verifica la red en tu wallet antes de enviar.' : 'Sending on the wrong network loses your funds. Check the network in your wallet before sending.'}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Modal USDT (iluminado, con QR + copiar)
function CryptoModal({ es, crypto, onClose, onDone }: any) {
  const [txid, setTxid] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState('');
  const net = (crypto.network || 'trc20').toUpperCase();
  const addr = crypto.address || '';
  // Monto EXACTO a enviar: el único (match_amount) para que se confirme solo on-chain.
  const amt = crypto.match_amount != null ? crypto.match_amount : crypto.amountUsd;
  const qrSrc = addr ? `/api/qr?data=${encodeURIComponent(addr)}&size=220&fg=0b1020&bg=ffffff` : '';
  async function copy(text: string, tag: string) {
    try { await navigator.clipboard.writeText(text); setCopied(tag); setTimeout(() => setCopied(''), 1600); } catch { toastErr(es ? 'No se pudo copiar' : 'Could not copy'); }
  }
  async function submit() {
    if (!txid.trim()) { toastErr(es ? 'Pega el hash de tu transacción.' : 'Paste your transaction hash.'); return; }
    setSending(true);
    try { const r = await fetch('/api/botlab/crypto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId: crypto.id, txid }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); onDone(); } catch (er: any) { toastErr(er?.message); } finally { setSending(false); }
  }
  const inp: any = { width: '100%', padding: '11px 12px', borderRadius: 11, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 13 };
  const copyBtn: any = { flex: 'none', padding: '8px 12px', borderRadius: 9, border: '1px solid color-mix(in srgb,var(--green) 45%,transparent)', background: 'color-mix(in srgb,var(--green) 12%,transparent)', color: 'var(--green)', cursor: 'pointer', fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap' };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(3,6,14,.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', background: 'linear-gradient(180deg, color-mix(in srgb,var(--green) 8%,var(--card)), var(--card))', border: '1px solid color-mix(in srgb,var(--green) 40%,var(--line))', borderRadius: 22, padding: 24, width: 'min(430px,100%)', boxShadow: '0 0 0 1px color-mix(in srgb,var(--green) 18%,transparent), 0 24px 70px rgba(0,0,0,.6), 0 0 60px color-mix(in srgb,var(--green) 22%,transparent)' }}>
        {/* Halo superior */}
        <div style={{ position: 'absolute', top: -1, left: '18%', right: '18%', height: 2, background: 'linear-gradient(90deg,transparent,var(--green),transparent)', borderRadius: 2 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(120deg,var(--green),#12b981)', color: '#04150e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>₮</span>
          <h3 style={{ margin: 0, fontSize: 18 }}>{es ? 'Pagar con USDT' : 'Pay with USDT'}</h3>
          <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 800, letterSpacing: '.05em', padding: '4px 9px', borderRadius: 99, border: '1px solid var(--line)', color: 'var(--mut)' }}>{net}</span>
        </div>

        {addr ? (
          <>
            {/* Aviso de red BIEN visible: enviar por otra red pierde los fondos */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'color-mix(in srgb,var(--amber) 12%,transparent)', border: '1px solid color-mix(in srgb,var(--amber) 40%,transparent)', borderRadius: 12, padding: '9px 12px', margin: '8px 0' }}>
              <span style={{ fontSize: 15 }}>⚠</span>
              <span style={{ fontSize: 12.5, color: 'var(--tx)' }}>{es ? 'Envía USDT SOLO por la red' : 'Send USDT ONLY on'} <b style={{ color: 'var(--amber)' }}>{(NET_INFO[crypto.network]?.name) || net}</b>. {es ? 'Otra red pierde tus fondos.' : 'Another network loses your funds.'}</span>
            </div>
            {/* Monto */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', margin: '10px 0' }}>
              <span className="muted" style={{ fontSize: 12.5 }}>{es ? 'Monto exacto' : 'Exact amount'}</span>
              <b style={{ marginLeft: 'auto', fontSize: 17, color: 'var(--green)' }}>{amt} USDT</b>
              <button onClick={() => copy(String(amt), 'amt')} style={copyBtn}>{copied === 'amt' ? '✓' : (es ? 'Copiar' : 'Copy')}</button>
            </div>

            {/* QR para escanear */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, margin: '4px 0 12px' }}>
              <div style={{ padding: 10, background: '#fff', borderRadius: 16, boxShadow: '0 0 0 1px var(--line), 0 10px 30px color-mix(in srgb,var(--green) 22%,transparent)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt="QR USDT" width={200} height={200} style={{ display: 'block', width: 200, height: 200 }} />
              </div>
              <span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Escanea con tu wallet' : 'Scan with your wallet'}</span>
              {crypto.match_amount != null && <span style={{ fontSize: 11, color: 'var(--green)', textAlign: 'center' }}>{es ? 'Envía el monto EXACTO → tu robot se activa solo.' : 'Send the EXACT amount → your robot activates automatically.'}</span>}
            </div>

            {/* Dirección + copiar */}
            <div className="muted" style={{ fontSize: 12, marginBottom: 5 }}>{es ? 'O envía a esta dirección' : 'Or send to this address'}:</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', marginBottom: 14 }}>
              <div style={{ flex: 1, minWidth: 0, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 11, padding: '10px 12px', wordBreak: 'break-all', fontSize: 12.5, fontFamily: 'monospace' }}>{addr}</div>
              <button onClick={() => copy(addr, 'addr')} style={{ ...copyBtn, alignSelf: 'stretch' }}>{copied === 'addr' ? (es ? '✓ Copiado' : '✓ Copied') : (es ? 'Copiar' : 'Copy')}</button>
            </div>
          </>
        ) : (
          <div style={{ ...inp, color: 'var(--amber)', margin: '12px 0' }}>{es ? 'El administrador aún no configuró la wallet USDT.' : 'The admin has not set the USDT wallet yet.'}</div>
        )}

        <label className="muted" style={{ fontSize: 12.5 }}>{es ? 'Pega aquí el hash (txid) de tu envío' : 'Paste your transaction hash (txid)'}</label>
        <input style={{ ...inp, marginTop: 6 }} placeholder="0x… / trc20 hash" value={txid} onChange={(e) => setTxid(e.target.value)} />
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 'none', padding: '11px 16px', borderRadius: 11, border: '1px solid var(--line)', background: 'transparent', color: 'var(--tx)', cursor: 'pointer', fontWeight: 700 }}>{es ? 'Cerrar' : 'Close'}</button>
          <button onClick={submit} disabled={sending} style={{ flex: 1, padding: '11px 18px', borderRadius: 11, border: 'none', fontWeight: 800, cursor: 'pointer', background: 'linear-gradient(120deg,var(--green),#12b981)', color: '#04150e', opacity: sending ? .6 : 1, boxShadow: '0 8px 22px color-mix(in srgb,var(--green) 30%,transparent)' }}>{sending ? '…' : (es ? 'Ya pagué ✓' : 'I paid ✓')}</button>
        </div>
        <p className="muted" style={{ fontSize: 11.5, marginTop: 12, textAlign: 'center' }}>{es ? 'Activamos tu robot en cuanto confirmemos el pago en la blockchain.' : 'Your robot activates as soon as we confirm the payment on-chain.'}</p>
      </div>
    </div>
  );
}
