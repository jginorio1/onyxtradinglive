'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import VpsCallout from '@/app/components/VpsCallout';

// ============================================================
// Marketplace público de Bot Lab. Barra de control moderna (buscador +
// plataforma + orden), chips de categoría, contador y "cargar más".
// Recibe `items` ya mapeados desde el servidor (ficha técnica + sellos).
// ============================================================
const GOLD = '#ffd45e';
const PAGE = 9;   // cuántas tarjetas por tanda

export default function BotLabMarket({ es, items }: { es: boolean; items: any[] }) {
  const [style, setStyle] = useState('');
  const [tf, setTf] = useState('');
  const [mkt, setMkt] = useState('');
  const [q, setQ] = useState('');
  const [plat, setPlat] = useState('all');
  const [sort, setSort] = useState('reco');
  const [show, setShow] = useState(PAGE);
  const [ref, setRef] = useState('');
  // Referido de promoción: lo guardamos para que persista hasta la compra en el dashboard.
  useEffect(() => {
    try {
      const rf = new URLSearchParams(window.location.search).get('ref');
      if (rf) { localStorage.setItem('onyx_bl_ref', rf); setRef(rf); }
      else { const saved = localStorage.getItem('onyx_bl_ref'); if (saved) setRef(saved); }
    } catch {}
  }, []);
  const refQ = ref ? `&ref=${encodeURIComponent(ref)}` : '';

  // Opciones reales (solo las que existen en los robots publicados).
  const opts = useMemo(() => {
    const s = new Set<string>(), t = new Set<string>(), m = new Set<string>(), p = new Set<string>();
    items.forEach((i) => { if (i.spec_style) s.add(i.spec_style); if (i.spec_timeframe) t.add(i.spec_timeframe); if (i.spec_market) m.add(i.spec_market); if (i.plat) p.add(String(i.plat)); });
    return { styles: [...s], tfs: [...t], mkts: [...m], plats: [...p] };
  }, [items]);

  const qq = q.trim().toLowerCase();
  const priceNum = (p: any) => Number(String(p.price || '').replace(/[^0-9.]/g, '')) || 0;
  const filtered = useMemo(() => {
    let list = items.filter((i) =>
      (!style || i.spec_style === style) && (!tf || i.spec_timeframe === tf) && (!mkt || i.spec_market === mkt)
      && (plat === 'all' || String(i.plat || '').toLowerCase() === plat)
      && (!qq || `${i.name} ${i.seller || ''} ${i.pair || ''} ${i.spec_market || ''} ${i.spec_style || ''}`.toLowerCase().includes(qq)));
    if (sort === 'score') list = [...list].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    else if (sort === 'price') list = [...list].sort((a, b) => priceNum(a) - priceNum(b));
    else if (sort === 'price_desc') list = [...list].sort((a, b) => priceNum(b) - priceNum(a));
    return list;
  }, [items, style, tf, mkt, plat, qq, sort]);

  // Cambiar cualquier filtro reinicia la paginación.
  const reset = () => setShow(PAGE);
  const anyFilter = !!(style || tf || mkt || qq || plat !== 'all');

  const card: any = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: 15 };
  const chip = (on: boolean): any => ({ fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 99, cursor: 'pointer', border: '1px solid ' + (on ? 'var(--brand)' : 'var(--line)'), background: on ? 'color-mix(in srgb,var(--brand) 18%,transparent)' : 'transparent', color: on ? 'var(--brand)' : 'var(--mut)', textTransform: 'capitalize' });
  const sel: any = { padding: '10px 12px', borderRadius: 11, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--tx)', fontSize: 13.5, cursor: 'pointer' };
  const cap = (v: string) => (es ? { tendencia: 'Tendencia', ruptura: 'Ruptura', scalping: 'Scalping', intradia: 'Intradía', swing: 'Swing', rango: 'Rango', forex: 'Forex', oro: 'Oro', indices: 'Índices', cripto: 'Cripto', otro: 'Otro' }[v] || v : v);

  return (
    <div>
      {/* Barra de control: buscador + plataforma + orden */}
      {items.length > 3 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: 460 }}>
            <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--mut)', fontSize: 15, pointerEvents: 'none' }}>🔍</span>
            <input value={q} onChange={(e) => { setQ(e.target.value); reset(); }} placeholder={es ? 'Buscar robot por nombre, par, estilo…' : 'Search robot by name, pair, style…'} style={{ width: '100%', padding: '11px 14px 11px 38px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--tx)', fontSize: 14 }} />
          </div>
          {opts.plats.length > 1 && (
            <select value={plat} onChange={(e) => { setPlat(e.target.value); reset(); }} style={sel}>
              <option value="all">{es ? 'Todas las plataformas' : 'All platforms'}</option>
              {opts.plats.map((p) => <option key={p} value={p.toLowerCase()}>{p}</option>)}
            </select>
          )}
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={sel}>
            <option value="reco">{es ? 'Recomendados' : 'Recommended'}</option>
            <option value="score">{es ? 'Mejor Onyx Score' : 'Top Onyx Score'}</option>
            <option value="price">{es ? 'Precio ↑' : 'Price ↑'}</option>
            <option value="price_desc">{es ? 'Precio ↓' : 'Price ↓'}</option>
          </select>
        </div>
      )}

      {/* Chips de categoría */}
      {(opts.styles.length + opts.tfs.length + opts.mkts.length) > 0 && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 14 }}>
          {opts.styles.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: 11.5, fontWeight: 700 }}>{es ? 'Estilo' : 'Style'}</span>
              <button onClick={() => { setStyle(''); reset(); }} style={chip(!style)}>{es ? 'Todos' : 'All'}</button>
              {opts.styles.map((v) => <button key={v} onClick={() => { setStyle(v); reset(); }} style={chip(style === v)}>{cap(v)}</button>)}
            </div>
          )}
          {opts.tfs.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: 11.5, fontWeight: 700 }}>Timeframe</span>
              <button onClick={() => { setTf(''); reset(); }} style={chip(!tf)}>{es ? 'Todos' : 'All'}</button>
              {opts.tfs.map((v) => <button key={v} onClick={() => { setTf(v); reset(); }} style={chip(tf === v)}>{v}</button>)}
            </div>
          )}
          {opts.mkts.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: 11.5, fontWeight: 700 }}>{es ? 'Mercado' : 'Market'}</span>
              <button onClick={() => { setMkt(''); reset(); }} style={chip(!mkt)}>{es ? 'Todos' : 'All'}</button>
              {opts.mkts.map((v) => <button key={v} onClick={() => { setMkt(v); reset(); }} style={chip(mkt === v)}>{cap(v)}</button>)}
            </div>
          )}
        </div>
      )}

      {/* Contador + limpiar filtros */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16, fontSize: 12.5, color: 'var(--mut)' }}>
        <span>{filtered.length} {filtered.length === 1 ? (es ? 'robot' : 'robot') : (es ? 'robots' : 'robots')}</span>
        {anyFilter && <button onClick={() => { setStyle(''); setTf(''); setMkt(''); setQ(''); setPlat('all'); reset(); }} style={{ background: 'none', border: 'none', color: 'var(--brand)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{es ? 'Limpiar filtros' : 'Clear filters'}</button>}
      </div>

      <div style={{ display: 'grid', gap: 14 }} className="g4">
        {filtered.slice(0, show).map((p: any, i: number) => (
          <div key={p.id || i} style={{ ...card, position: 'relative', display: 'flex', flexDirection: 'column', ...(p.hot ? { border: `1.5px solid color-mix(in srgb,${GOLD} 60%,var(--line))` } : {}) }}>
            {p.hot && <span style={{ position: 'absolute', top: -10, right: 12, background: `linear-gradient(120deg,${GOLD},#ffb020)`, color: '#3a2a06', fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 99 }}>★ Top</span>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, background: 'linear-gradient(120deg,var(--brand),var(--brand2,#a06bff))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{(p.name || '?').slice(0, 1)}</div>
              <div style={{ minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div><div className="muted" style={{ fontSize: 11 }}>{p.seller} · {p.pair}</div></div>
            </div>
            <svg viewBox="0 0 300 60" preserveAspectRatio="none" style={{ width: '100%', height: 42, margin: '10px 0 8px' }}><path d={p.path} fill="none" stroke="var(--green)" strokeWidth="2.5" /></svg>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 8 }}>
              {[[p.score != null ? String(p.score) : '—', 'Score', GOLD], [p.ret || '—', es ? '90 días' : '90d', 'var(--green)'], [p.dd || '—', es ? 'DD máx' : 'Max DD', 'var(--tx)']].map(([v, l, c]: any, k) => (
                <div key={k} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 8, padding: '5px 4px', textAlign: 'center' }}><b style={{ fontSize: 13, color: c }}>{v}</b><div className="muted" style={{ fontSize: 9.5 }}>{l}</div></div>
              ))}
            </div>
            {/* Ficha: estilo · timeframe · mercado */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
              {p.spec_style && <span className="muted" style={{ fontSize: 10.5, border: '1px solid var(--line)', padding: '2px 7px', borderRadius: 7, textTransform: 'capitalize' }}>{cap(p.spec_style)}</span>}
              {p.spec_timeframe && <span className="muted" style={{ fontSize: 10.5, border: '1px solid var(--line)', padding: '2px 7px', borderRadius: 7 }}>{p.spec_timeframe}</span>}
              {p.spec_market && <span className="muted" style={{ fontSize: 10.5, border: '1px solid var(--line)', padding: '2px 7px', borderRadius: 7, textTransform: 'capitalize' }}>{cap(p.spec_market)}</span>}
              {p.spec_direction && <span className="muted" style={{ fontSize: 10.5, border: '1px solid var(--line)', padding: '2px 7px', borderRadius: 7, textTransform: 'capitalize' }}>{p.spec_direction === 'both' ? (es ? 'Long y Short' : 'Long & Short') : p.spec_direction}</span>}
              {p.spec_capital && <span className="muted" style={{ fontSize: 10.5, border: '1px solid var(--line)', padding: '2px 7px', borderRadius: 7 }}>{es ? 'Desde' : 'From'} {p.spec_capital}</span>}
              {p.spec_maxdd && <span className="muted" style={{ fontSize: 10.5, border: '1px solid var(--line)', padding: '2px 7px', borderRadius: 7 }}>DD ≤ {p.spec_maxdd}</span>}
            </div>
            {/* Sellos */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
              {[[p.no_martingale, es ? 'Sin martingala' : 'No martingale'], [p.no_hft, es ? 'Sin alta frec.' : 'No HFT'], [p.has_sl, 'Stop Loss'], [p.news, es ? 'Noticias' : 'News'], [p.spec_propfirm, es ? 'Prop firm' : 'Prop firm']].filter(([ok]: any) => ok).map(([, l]: any, k) => (
                <span key={k} style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--green)', background: 'color-mix(in srgb,var(--green) 10%,transparent)', border: '1px solid color-mix(in srgb,var(--green) 30%,transparent)', borderRadius: 99, padding: '2px 7px' }}>✓ {l}</span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--brand)', border: '1px solid color-mix(in srgb,var(--brand) 30%,transparent)', borderRadius: 6, padding: '2px 6px' }}>{p.plat}</span>
              <b style={{ fontSize: 15 }}>{p.price}<small className="muted" style={{ fontSize: 11, fontWeight: 600 }}>{p.unit}</small></b>
            </div>
            <Link href={p.id ? `/dashboard/bot-lab?tab=market&p=${p.id}${refQ}` : '/dashboard/bot-lab'} style={{ display: 'block', marginTop: 10, textAlign: 'center', fontSize: 12.5, fontWeight: 800, padding: '9px', borderRadius: 9, background: 'var(--brand)', color: '#0b1020' }}>{es ? 'Ver robot' : 'View robot'}</Link>
            <VpsCallout variant="inline" gold />
          </div>
        ))}
      </div>

      {filtered.length > show && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button onClick={() => setShow((n) => n + PAGE)} style={{ padding: '11px 24px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--tx)', fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}>
            {es ? `Cargar más (${filtered.length - show})` : `Load more (${filtered.length - show})`}
          </button>
        </div>
      )}

      {!filtered.length && <p className="muted" style={{ fontSize: 13, textAlign: 'center', marginTop: 16 }}>{es ? 'Ningún robot con esos filtros. Prueba otra combinación.' : 'No robots match those filters. Try another combination.'}</p>}
    </div>
  );
}
