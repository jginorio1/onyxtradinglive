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
  const [pay, setPay] = useState<any>({ card: false, crypto: true, monthly: false }); // métodos globales
  const [focusId, setFocusId] = useState<string>(''); // producto a resaltar (deep-link desde la landing)

  async function loadMarket() { try { const r = await fetch('/api/botlab/products?limit=60'); const j = await r.json(); setProducts(j.products || []); if (j.pay) setPay(j.pay); } catch {} }
  async function loadLicenses() { try { const r = await fetch('/api/botlab/licenses'); const j = await r.json(); setLicenses(j.licenses || []); } catch {} }
  async function loadSell() { try { const r = await fetch('/api/botlab/sell'); const j = await r.json(); setSell(j); } catch {} }

  useEffect(() => {
    loadMarket(); loadLicenses(); loadSell();
    try {
      const sp = new URLSearchParams(window.location.search);
      const t = sp.get('tab'); if (t === 'vender' || t === 'licencias' || t === 'market' || t === 'ganancias') setView(t as View);
      // Deep-link a un robot concreto desde la landing: abre el marketplace y lo resalta.
      const pid = sp.get('p'); if (pid) { setView('market'); setFocusId(pid); }
      // Viene del constructor con "Vender este robot": abre el formulario ya prellenado.
      if (sp.get('new') === '1') {
        setView('vender');
        setEditing({
          name: sp.get('name') || '', platform: sp.get('platform') || 'mt5',
          tagline: sp.get('tagline') || '', description: sp.get('desc') || '',
          kind: 'subscription', interval: 'month', price: 29, category: sp.get('category') || '',
          bot_magic: sp.get('magic') || '', bot_account: sp.get('account') || '',
          // Del constructor: viene el robot ya elegido (source=build + su receta), para vender en 1 clic.
          source: 'build', build_id: sp.get('build') || '',
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

  // Cuando llegas con ?p=<id> desde la landing, desplaza y resalta ese robot en cuanto carga.
  useEffect(() => {
    if (!focusId || !products.length) return;
    const el = document.getElementById('bl-prod-' + focusId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setFocusId(''), 2600);
    return () => clearTimeout(t);
  }, [focusId, products]);

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

  // Descarga PROTEGIDA del archivo del robot (solo con licencia activa).
  async function download(productId: string, platform?: string) {
    try {
      // Robot del constructor: pedimos una plataforma → el servidor devuelve el ARCHIVO
      // generado con el candado. Robot de archivo externo: devuelve una URL firmada.
      const qs = '/api/botlab/download?id=' + encodeURIComponent(productId) + (platform ? '&platform=' + platform : '');
      const r = await fetch(qs);
      if (platform) {
        if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'error'); }
        const blob = await r.blob();
        const cd = r.headers.get('content-disposition') || '';
        const nm = (/filename="?([^"]+)"?/.exec(cd)?.[1]) || ('robot.' + (platform === 'ctrader' ? 'cs' : platform === 'mt4' ? 'mq4' : 'mq5'));
        const u = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = u; a.download = nm; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(u), 4000);
        return;
      }
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'error');
      if (j.url) window.location.href = j.url;
      else toastErr(es ? 'Descarga no disponible.' : 'Download not available.');
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
                  <div key={p.id} id={'bl-prod-' + p.id} style={{ ...card, ...(focusId === p.id ? { border: '1.5px solid var(--brand)', boxShadow: '0 0 0 3px color-mix(in srgb,var(--brand) 22%,transparent)' } : {}) }}>
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
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {p.platform && p.platform !== 'any' && <span className="muted" style={{ fontSize: 11, border: '1px solid var(--line)', padding: '2px 7px', borderRadius: 7 }}>{String(p.platform).toUpperCase()}</span>}
                      {p.spec_style && <span className="muted" style={{ fontSize: 11, border: '1px solid var(--line)', padding: '2px 7px', borderRadius: 7, textTransform: 'capitalize' }}>{p.spec_style}</span>}
                      {p.spec_timeframe && <span className="muted" style={{ fontSize: 11, border: '1px solid var(--line)', padding: '2px 7px', borderRadius: 7 }}>{p.spec_timeframe}</span>}
                      {p.spec_market && <span className="muted" style={{ fontSize: 11, border: '1px solid var(--line)', padding: '2px 7px', borderRadius: 7, textTransform: 'capitalize' }}>{p.spec_market}</span>}
                      {p.perf?.days != null && <span className="muted" style={{ fontSize: 11, border: '1px solid var(--line)', padding: '2px 7px', borderRadius: 7 }}>{p.perf.days} {es ? 'días' : 'days'}</span>}
                    </div>
                    {/* Sellos de garantía (auto-detectados + declarados) */}
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                      {[[!p.perf?.martingale, es ? 'Sin martingala' : 'No martingale'], [!p.perf?.hft, es ? 'Sin alta frecuencia' : 'No HFT'], [p.spec_sl || p.perf?.hasSL, es ? 'Con Stop Loss' : 'Stop Loss'], [p.spec_news, es ? 'Filtro noticias' : 'News filter']].filter(([ok]: any) => ok).map(([, l]: any, k) => (
                        <span key={k} style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--green)', background: 'color-mix(in srgb,var(--green) 10%,transparent)', border: '1px solid color-mix(in srgb,var(--green) 30%,transparent)', borderRadius: 99, padding: '2px 7px' }}>✓ {l}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                      <b style={{ fontSize: 18 }}>{money(p.price_cents)}</b><span className="muted" style={{ fontSize: 12 }}>{(pay.monthly && p.kind === 'subscription') ? (es ? '/mes' : '/mo') : (es ? 'único' : 'once')}</span>
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
                        {pay.card && <button onClick={() => buy(p, 'card')} className="muted" style={{ width: '100%', marginTop: 6, padding: '6px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 11.5, border: 'none', background: 'transparent' }}>{es ? 'o pagar con tarjeta' : 'or pay by card'}</button>}
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
                    <div className="muted" style={{ fontSize: 12 }}>{l.method === 'usdt' ? 'USDT' : (es ? 'Tarjeta' : 'Card')} · {(pay.monthly && l.kind === 'subscription') ? (es ? 'renta mensual' : 'monthly') : (es ? 'pago único' : 'one-time')}{active && days != null && days >= 0 ? ` · ${es ? 'renueva en' : 'renews in'} ${days} ${es ? 'días' : 'days'}` : ''}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 99, color: c, border: `1px solid color-mix(in srgb,${c} 40%,transparent)` }}>
                    {active ? '✓ ' : ''}{label}
                  </span>
                  {active
                    ? (l.product?.source === 'build'
                        // Robot del constructor: descarga generada con candado, por plataforma.
                        ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', width: '100%', marginTop: 4 }}>
                            {([['mt5', 'MT5'], ['mt4', 'MT4'], ['ctrader', 'cTrader']] as [string, string][]).map(([pv, pl]) => (
                              <button key={pv} onClick={() => l.product_id && download(l.product_id, pv)} style={{ fontSize: 12, fontWeight: 800, cursor: 'pointer', border: '1px solid color-mix(in srgb,var(--brand) 45%,transparent)', background: 'color-mix(in srgb,var(--brand) 12%,transparent)', color: 'var(--brand)', borderRadius: 9, padding: '6px 11px' }}>⬇ {pl}</button>
                            ))}
                          </div>
                        : <button onClick={() => l.product_id && download(l.product_id)} style={{ fontSize: 12.5, fontWeight: 800, cursor: 'pointer', border: '1px solid color-mix(in srgb,var(--brand) 45%,transparent)', background: 'color-mix(in srgb,var(--brand) 14%,transparent)', color: 'var(--brand)', borderRadius: 9, padding: '6px 12px' }}>{es ? '⬇ Descargar robot' : '⬇ Download robot'}</button>)
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
      {editing && <ProductModal es={es} product={editing} pay={pay} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); loadSell(); }} />}

      <style>{`@media(max-width:820px){.bl-shell{flex-direction:column}.bl-side{position:static!important;flex:none!important;width:100%}.bl-nav{flex-direction:row!important;flex-wrap:wrap}}`}</style>
    </div>
  );
}

// ---------------------------------------------------------------- Vender
function SellPanel({ es, sell, reload, onEdit }: any) {
  async function del(id: string) {
    try { await fetch('/api/botlab/sell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) }); reload(); } catch {}
  }
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ ...card, background: 'color-mix(in srgb,var(--green) 8%,var(--card))', borderColor: 'color-mix(in srgb,var(--green) 30%,var(--line))' }}>
        <b style={{ fontSize: 13.5 }}>₮ {es ? 'Cobras en USDT' : 'You get paid in USDT'}</b>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{es ? 'Vende tu robot y retira tus ganancias en USDT desde la pestaña Ganancias. Sin bancos ni tarjetas.' : 'Sell your robot and withdraw your earnings in USDT from the Earnings tab. No banks or cards.'}</div>
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
  const [addr, setAddr] = useState('');
  const [net, setNet] = useState('trc20');
  const inp: any = { padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 13.5 };
  async function payout() {
    if (!addr.trim()) { toastErr(es ? 'Pon tu dirección USDT.' : 'Enter your USDT address.'); return; }
    try { const r = await fetch('/api/botlab/sell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'payout', method: 'usdt', destination: `${net.toUpperCase()}:${addr.trim()}` }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); toast(es ? 'Retiro solicitado. Te pagamos en USDT.' : 'Payout requested. We pay you in USDT.'); setAddr(''); reload(); } catch (er: any) { toastErr(er?.message); }
  }
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
        {[[es ? 'Disponible' : 'Available', money(e.availableCents || 0), 'var(--green)'], [es ? 'Ventas' : 'Sales', String(e.sales || 0), 'var(--tx)'], [es ? 'Bruto' : 'Gross', money(e.grossCents || 0), 'var(--tx)'], [es ? 'Pagado' : 'Paid', money(e.paidCents || 0), 'var(--mut)']].map(([l, v, c], i) => (
          <div key={i} style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14 }}><div className="muted" style={{ fontSize: 12 }}>{l}</div><div style={{ fontSize: 22, fontWeight: 800, color: c as string }}>{v}</div></div>
        ))}
      </div>
      <div style={{ ...card }}>
        <b>₮ {es ? 'Retirar tus ganancias en USDT' : 'Withdraw your earnings in USDT'}</b>
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{es ? 'Desde $10 disponibles. Pon tu wallet USDT y te lo enviamos.' : 'From $10 available. Enter your USDT wallet and we send it.'}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={{ ...inp, flex: 'none' }} value={net} onChange={(ev) => setNet(ev.target.value)}><option value="trc20">TRON (TRC20)</option><option value="erc20">Ethereum (ERC20)</option></select>
          <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder={es ? 'Tu dirección USDT (T… / 0x…)' : 'Your USDT address (T… / 0x…)'} value={addr} onChange={(ev) => setAddr(ev.target.value)} />
          <button onClick={payout} disabled={(e.availableCents || 0) < 1000} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', fontWeight: 800, cursor: (e.availableCents || 0) < 1000 ? 'not-allowed' : 'pointer', opacity: (e.availableCents || 0) < 1000 ? .5 : 1, background: `linear-gradient(120deg,${GOLD},#ffb020)`, color: '#3a2a06' }}>{es ? 'Solicitar retiro' : 'Request payout'}</button>
        </div>
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
function ProductModal({ es, product, pay, onClose, onSaved }: any) {
  const monthlyOn = pay?.monthly === true;   // ¿el dueño permite cobro mensual?
  const cardOn = pay?.card === true;         // ¿el dueño acepta tarjeta?
  const [f, setF] = useState<any>({ name: '', tagline: '', interval: 'month', price: 29, platform: 'mt5', category: '', accepts_crypto: true, source: 'build', ...product,
    kind: monthlyOn ? (product?.kind || 'subscription') : 'one_time',   // sin mensual → siempre pago único
    accepts_card: cardOn ? (product?.accepts_card !== false) : false,   // tarjeta apagada → no la aceptan
    source: product?.source || 'build',   // Modelo A por defecto: robot del constructor
    price: product?.price_cents != null ? product.price_cents / 100 : (product?.price ?? 29) });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Recetas del constructor del vendedor (para ligar el robot · Modelo A).
  const [builds, setBuilds] = useState<any[]>([]);
  const [elig, setElig] = useState<any>(null);      // chequeo de elegibilidad para vender
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    fetch('/api/botlab/sell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'my_builds' }) })
      .then((r) => r.json()).then((j) => setBuilds(j.builds || [])).catch(() => {});
  }, []);
  // Prellenar la ficha desde la receta cuando el robot llega ya elegido (venta en 1 clic).
  useEffect(() => {
    if (!f.build_id || !builds.length) return;
    const b = builds.find((x) => x.id === f.build_id); if (!b) return;
    const sp = b.spec || {}; const sym = String(sp.symbol || '').toUpperCase();
    const mkt = /XAU|GOLD/.test(sym) ? 'oro' : /BTC|ETH|USDT/.test(sym) ? 'cripto' : /US30|NAS|SPX|GER|UK100|JP225|IDX/.test(sym) ? 'indices' : sym ? 'forex' : '';
    const dir = (sp.allowLongs && sp.allowShorts) ? 'both' : sp.allowShorts ? 'short' : sp.allowLongs ? 'long' : '';
    setF((prev: any) => ({ ...prev, platform: b.platform || prev.platform, bot_magic: prev.bot_magic || b.magic,
      spec_timeframe: prev.spec_timeframe || sp.tf || '', spec_market: prev.spec_market || mkt, spec_symbols: prev.spec_symbols || sym,
      spec_direction: prev.spec_direction || dir, spec_sl: prev.spec_sl || (Number(sp.slVal) > 0), spec_news: prev.spec_news || !!sp.useNewsFilter }));
  }, [f.build_id, builds]); // eslint-disable-line
  // Comprueba si el robot ya puede venderse (operaciones, días, SL, sin martingala/HFT).
  async function runCheck() {
    if (!f.build_id) return;
    setChecking(true);
    try {
      const r = await fetch('/api/botlab/sell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'check', product: { bot_magic: f.bot_magic, bot_account: f.bot_account, spec_sl: !!f.spec_sl, name: f.name } }) });
      setElig(await r.json());
    } catch { setElig(null); } finally { setChecking(false); }
  }
  useEffect(() => { if (f.build_id) runCheck(); }, [f.build_id]); // eslint-disable-line
  const inp: any = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 14 };
  // Sube el archivo del robot (.ex5/.ex4/.set/.zip) al bucket privado y guarda su ruta.
  async function uploadFile(file: File) {
    if (file.size > 20 * 1024 * 1024) { toastErr(es ? 'Máximo 20 MB.' : 'Max 20 MB.'); return; }
    setUploading(true);
    try {
      const data: string = await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result)); rd.onerror = rej; rd.readAsDataURL(file); });
      const r = await fetch('/api/botlab/sell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'upload_file', name: file.name, data }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      setF((prev: any) => ({ ...prev, file_path: j.file_path, file_name: j.file_name, file_size: j.file_size }));
      toast(es ? 'Archivo subido.' : 'File uploaded.');
    } catch (er: any) { toastErr(er?.message); } finally { setUploading(false); }
  }
  async function save() {
    if (!f.name?.trim()) { toastErr(es ? 'Ponle nombre a tu robot.' : 'Name your robot.'); return; }
    if (f.source === 'build' && !f.build_id) { toastErr(es ? 'Elige cuál de tus robots del constructor vas a vender.' : 'Pick which constructor robot to sell.'); return; }
    setSaving(true);
    try {
      const body = { action: 'save', product: { id: product?.id, name: f.name, tagline: f.tagline, description: f.description, kind: f.kind, interval: f.interval, price_cents: Math.round(Number(f.price) * 100), platform: f.platform, category: f.category, proof_url: f.proof_url, bot_magic: f.bot_magic || null, bot_account: f.bot_account || null, source: f.source || 'build', build_id: f.source === 'build' ? (f.build_id || null) : null, accepts_card: f.accepts_card, accepts_crypto: f.accepts_crypto, file_path: f.file_path ?? null, file_name: f.file_name ?? null, file_size: f.file_size ?? null, spec_style: f.spec_style || null, spec_timeframe: f.spec_timeframe || null, spec_market: f.spec_market || null, spec_news: !!f.spec_news, spec_sl: !!f.spec_sl, spec_risk: f.spec_risk || null, spec_capital: f.spec_capital || null, spec_direction: f.spec_direction || null, spec_symbols: f.spec_symbols || null, spec_maxdd: f.spec_maxdd || null, spec_propfirm: !!f.spec_propfirm, spec_broker: f.spec_broker || null } };
      const r = await fetch('/api/botlab/sell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      toast(j.status === 'active' ? (es ? '¡Publicado! Ya está en el marketplace.' : 'Published! It’s live in the marketplace.') : (es ? 'Enviado a revisión.' : 'Sent for review.')); onSaved();
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
            {monthlyOn
              ? <select style={inp} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="subscription">{es ? 'Renta mensual' : 'Monthly rental'}</option><option value="one_time">{es ? 'Pago único' : 'One-time'}</option></select>
              : <div style={{ ...inp, display: 'flex', alignItems: 'center', color: 'var(--mut)' }}>{es ? 'Pago único' : 'One-time'}</div>}
            {/* La plataforma la define el robot del constructor; el comprador recibe los 3 formatos. */}
            <div style={{ ...inp, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--mut)' }}>
              <span>MT5 · MT4 · cTrader</span><span style={{ fontSize: 12 }}>🔒</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="muted" style={{ fontSize: 14 }}>$</span><input type="number" style={inp} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
            <input style={inp} placeholder={es ? 'Categoría (scalping…)' : 'Category (scalping…)'} value={f.category || ''} onChange={(e) => setF({ ...f, category: e.target.value })} />
          </div>
          {/* Ficha técnica que verá el comprador (Onyx la contrasta con las operaciones reales) */}
          <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{es ? 'Ficha técnica del robot' : 'Robot spec sheet'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <select style={inp} value={f.spec_style || ''} onChange={(e) => setF({ ...f, spec_style: e.target.value })}><option value="">{es ? 'Estilo…' : 'Style…'}</option><option value="tendencia">{es ? 'Tendencia' : 'Trend'}</option><option value="ruptura">{es ? 'Ruptura' : 'Breakout'}</option><option value="scalping">Scalping</option><option value="intradia">{es ? 'Intradía' : 'Intraday'}</option><option value="swing">Swing</option><option value="rango">{es ? 'Rango' : 'Range'}</option></select>
            <input style={inp} placeholder={es ? 'Timeframe (ej. H1 · H4)' : 'Timeframe (e.g. H1 · H4)'} value={f.spec_timeframe || ''} onChange={(e) => setF({ ...f, spec_timeframe: e.target.value })} />
            <select style={inp} value={f.spec_market || ''} onChange={(e) => setF({ ...f, spec_market: e.target.value })}><option value="">{es ? 'Mercado…' : 'Market…'}</option><option value="forex">Forex</option><option value="oro">{es ? 'Oro' : 'Gold'}</option><option value="indices">{es ? 'Índices' : 'Indices'}</option><option value="cripto">{es ? 'Cripto' : 'Crypto'}</option><option value="otro">{es ? 'Otro' : 'Other'}</option></select>
            <input style={inp} placeholder={es ? 'Riesgo por operación (ej. 1%)' : 'Risk per trade (e.g. 1%)'} value={f.spec_risk || ''} onChange={(e) => setF({ ...f, spec_risk: e.target.value })} />
            <select style={inp} value={f.spec_direction || ''} onChange={(e) => setF({ ...f, spec_direction: e.target.value })}><option value="">{es ? 'Dirección…' : 'Direction…'}</option><option value="both">{es ? 'Ambas (long y short)' : 'Both (long & short)'}</option><option value="long">Long</option><option value="short">Short</option></select>
            <input style={inp} placeholder={es ? 'Pares/símbolos (ej. XAUUSD)' : 'Symbols (e.g. XAUUSD)'} value={f.spec_symbols || ''} onChange={(e) => setF({ ...f, spec_symbols: e.target.value })} />
            <input style={inp} placeholder={es ? 'Capital mínimo (ej. $500)' : 'Min capital (e.g. $500)'} value={f.spec_capital || ''} onChange={(e) => setF({ ...f, spec_capital: e.target.value })} />
            <input style={inp} placeholder={es ? 'Drawdown máximo (ej. 15%)' : 'Max drawdown (e.g. 15%)'} value={f.spec_maxdd || ''} onChange={(e) => setF({ ...f, spec_maxdd: e.target.value })} />
          </div>
          <input style={inp} placeholder={es ? 'Bróker/cuenta recomendada (ej. ECN · spread bajo · hedging)' : 'Recommended broker/account (e.g. ECN · low spread · hedging)'} value={f.spec_broker || ''} onChange={(e) => setF({ ...f, spec_broker: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <PayChip on={!!f.spec_sl} onClick={() => setF({ ...f, spec_sl: !f.spec_sl })} icon="🛡" label={es ? 'Usa Stop Loss (obligatorio)' : 'Uses Stop Loss (required)'} />
            <PayChip on={!!f.spec_news} onClick={() => setF({ ...f, spec_news: !f.spec_news })} icon="📰" label={es ? 'Filtro de noticias' : 'News filter'} />
            <PayChip on={!!f.spec_propfirm} onClick={() => setF({ ...f, spec_propfirm: !f.spec_propfirm })} icon="🏦" label={es ? 'Apto para prop firm' : 'Prop-firm ready'} />
          </div>
          <input style={inp} placeholder={es ? 'Myfxbook / FXBlue (opcional)' : 'Myfxbook / FXBlue (optional)'} value={f.proof_url || ''} onChange={(e) => setF({ ...f, proof_url: e.target.value })} />
          <span className="muted" style={{ fontSize: 11.5, marginTop: -4 }}>{es ? 'Onyx aprueba con las operaciones REALES de tu robot (por su magic). Este enlace externo es opcional y le da más confianza al comprador.' : 'Onyx approves using your robot\'s REAL trades (by its magic). This external link is optional and adds buyer trust.'}</span>
          {cardOn ? (
            <div>
              <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>{es ? 'Métodos de pago que aceptas' : 'Payment methods you accept'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <PayChip on={f.accepts_card !== false} onClick={() => setF({ ...f, accepts_card: !(f.accepts_card !== false) })} icon="💳" label={es ? 'Tarjeta' : 'Card'} />
                <PayChip on={f.accepts_crypto !== false} onClick={() => setF({ ...f, accepts_crypto: !(f.accepts_crypto !== false) })} icon="₮" label="USDT" />
              </div>
            </div>
          ) : null}
          <div>
            <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>{es ? 'Robot del constructor (lo recibe el comprador)' : 'Constructor robot (the buyer receives it)'}</div>
            <select style={inp} value={f.build_id || ''} onChange={(e) => {
              const b = builds.find((x) => x.id === e.target.value);
              const sp = b?.spec || {};
              const sym = String(sp.symbol || '').toUpperCase();
              const mkt = /XAU|GOLD/.test(sym) ? 'oro' : /BTC|ETH|USDT/.test(sym) ? 'cripto' : /US30|NAS|SPX|GER|UK100|JP225|IDX/.test(sym) ? 'indices' : sym ? 'forex' : '';
              const dir = (sp.allowLongs && sp.allowShorts) ? 'both' : sp.allowShorts ? 'short' : sp.allowLongs ? 'long' : '';
              setF((prev: any) => ({
                ...prev, build_id: e.target.value, platform: b?.platform || prev.platform, bot_magic: b?.magic || prev.bot_magic,
                // Prellenado desde la receta (el vendedor puede ajustarlo).
                spec_timeframe: prev.spec_timeframe || sp.tf || '',
                spec_market: prev.spec_market || mkt,
                spec_symbols: prev.spec_symbols || sym,
                spec_direction: prev.spec_direction || dir,
                spec_sl: prev.spec_sl || (Number(sp.slVal) > 0),
                spec_news: prev.spec_news || !!sp.useNewsFilter,
              }));
            }}>
              <option value="">{es ? 'Elige tu robot del constructor…' : 'Pick your constructor robot…'}</option>
              {builds.map((b) => (
                <option key={b.id} value={b.id}>{b.name} · {b.platform === 'ctrader' ? 'cTrader' : String(b.platform || 'mt5').toUpperCase()} · 🔒{b.magic}</option>
              ))}
            </select>
            <span className="muted" style={{ fontSize: 11 }}>{es
              ? 'Onyx genera el archivo protegido (con candado) para MT5, MT4 y cTrader al momento de la compra. El comprador lo corre solo con licencia activa.'
              : 'Onyx generates the protected (locked) file for MT5, MT4 and cTrader at purchase time. The buyer runs it only with an active license.'}</span>
            {!builds.length && <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{es ? 'No tienes robots del constructor todavía. Créalo en el Constructor y vuelve aquí.' : 'You have no constructor robots yet. Build one first.'}</div>}
          </div>
          {/* Chequeo de elegibilidad: le dice al vendedor si ya puede vender, sin sorpresas. */}
          {f.build_id && (
            <div style={{ border: `1px solid ${elig ? (elig.ok ? 'color-mix(in srgb,var(--green) 40%,transparent)' : 'color-mix(in srgb,var(--amber) 45%,transparent)') : 'var(--line)'}`, background: elig ? (elig.ok ? 'color-mix(in srgb,var(--green) 8%,transparent)' : 'color-mix(in srgb,var(--amber) 8%,transparent)') : 'var(--bg2)', borderRadius: 10, padding: '11px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                <b style={{ fontSize: 13 }}>{checking ? (es ? 'Comprobando…' : 'Checking…') : !elig ? (es ? '¿Listo para vender?' : 'Ready to sell?') : elig.ok ? (es ? '✓ Listo para vender' : '✓ Ready to sell') : (es ? 'Aún le falta para venderse' : 'Not sellable yet')}</b>
                <button type="button" onClick={runCheck} disabled={checking} className="muted" style={{ fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--line)', background: 'transparent', borderRadius: 8, padding: '4px 10px', color: 'var(--tx)' }}>{es ? 'Comprobar' : 'Check'}</button>
              </div>
              {elig && !elig.hasData && <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{es ? 'Este robot aún no tiene operaciones reales. Instálalo, déjalo operar y vuelve.' : 'This robot has no real trades yet. Install it, let it trade and come back.'}</div>}
              {elig && !!elig.checks && (
                <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
                  {elig.checks.map((c: any) => (
                    <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ color: c.ok ? 'var(--green)' : 'var(--amber)', fontWeight: 800 }}>{c.ok ? '✓' : '○'}</span>
                      <span style={{ color: c.ok ? 'var(--mut)' : 'var(--tx)' }}>{es ? c.label : c.en}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="muted" style={{ fontSize: 10.5, marginTop: 7 }}>{es ? 'Onyx aprueba con las operaciones reales del robot. Si algo falta, déjalo operar más y vuelve.' : 'Onyx approves using the robot’s real trades. If something’s missing, let it trade more and come back.'}</div>
            </div>
          )}
          {/* Cobro en USDT, siempre visible. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'color-mix(in srgb,var(--green) 12%,transparent)', border: '1px solid color-mix(in srgb,var(--green) 35%,transparent)', borderRadius: 10, padding: '11px 12px' }}>
            <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 7, background: 'var(--green)', color: '#04150e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>₮</span>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--green)' }}>{es ? 'Cobras en USDT (TRON · Ethereum)' : 'You get paid in USDT (TRON · Ethereum)'}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>{es ? 'Sin bancos ni tarjetas · sin contracargos. Retiras desde Ganancias.' : 'No banks or cards · no chargebacks. Withdraw from Earnings.'}</div>
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
              {crypto.match_amount != null && <span style={{ fontSize: 11, color: 'var(--green)', textAlign: 'center' }}>{es ? 'Envía el monto EXACTO para identificar tu pago más rápido.' : 'Send the EXACT amount so we can match your payment faster.'}</span>}
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
        <p className="muted" style={{ fontSize: 11.5, marginTop: 12, textAlign: 'center' }}>{es ? 'Verificamos tu pago en la blockchain y activamos tu robot (normalmente en minutos, máx. unas horas). Te avisamos al confirmarlo.' : 'We verify your payment on-chain and activate your robot (usually within minutes, up to a few hours). We’ll notify you once confirmed.'}</p>
      </div>
    </div>
  );
}
