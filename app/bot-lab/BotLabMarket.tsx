'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';

// ============================================================
// Marketplace público de Bot Lab con FILTROS por categoría.
// Recibe `items` ya mapeados desde el servidor (cada uno con su ficha técnica
// y sellos). Filtra en el navegador por estilo, timeframe y mercado.
// ============================================================
const GOLD = '#ffd45e';

export default function BotLabMarket({ es, items }: { es: boolean; items: any[] }) {
  const [style, setStyle] = useState('');
  const [tf, setTf] = useState('');
  const [mkt, setMkt] = useState('');

  // Opciones reales (solo las que existen en los robots publicados).
  const opts = useMemo(() => {
    const s = new Set<string>(), t = new Set<string>(), m = new Set<string>();
    items.forEach((i) => { if (i.spec_style) s.add(i.spec_style); if (i.spec_timeframe) t.add(i.spec_timeframe); if (i.spec_market) m.add(i.spec_market); });
    return { styles: [...s], tfs: [...t], mkts: [...m] };
  }, [items]);

  const filtered = items.filter((i) =>
    (!style || i.spec_style === style) && (!tf || i.spec_timeframe === tf) && (!mkt || i.spec_market === mkt));

  const card: any = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: 15 };
  const chip = (on: boolean): any => ({ fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 99, cursor: 'pointer', border: '1px solid ' + (on ? 'var(--brand)' : 'var(--line)'), background: on ? 'color-mix(in srgb,var(--brand) 18%,transparent)' : 'transparent', color: on ? 'var(--brand)' : 'var(--mut)', textTransform: 'capitalize' });
  const cap = (v: string) => (es ? { tendencia: 'Tendencia', ruptura: 'Ruptura', scalping: 'Scalping', intradia: 'Intradía', swing: 'Swing', rango: 'Rango', forex: 'Forex', oro: 'Oro', indices: 'Índices', cripto: 'Cripto', otro: 'Otro' }[v] || v : v);

  return (
    <div>
      {/* Barra de filtros */}
      {(opts.styles.length + opts.tfs.length + opts.mkts.length) > 0 && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
          {opts.styles.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: 11.5, fontWeight: 700 }}>{es ? 'Estilo' : 'Style'}</span>
              <button onClick={() => setStyle('')} style={chip(!style)}>{es ? 'Todos' : 'All'}</button>
              {opts.styles.map((v) => <button key={v} onClick={() => setStyle(v)} style={chip(style === v)}>{cap(v)}</button>)}
            </div>
          )}
          {opts.tfs.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: 11.5, fontWeight: 700 }}>Timeframe</span>
              <button onClick={() => setTf('')} style={chip(!tf)}>{es ? 'Todos' : 'All'}</button>
              {opts.tfs.map((v) => <button key={v} onClick={() => setTf(v)} style={chip(tf === v)}>{v}</button>)}
            </div>
          )}
          {opts.mkts.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: 11.5, fontWeight: 700 }}>{es ? 'Mercado' : 'Market'}</span>
              <button onClick={() => setMkt('')} style={chip(!mkt)}>{es ? 'Todos' : 'All'}</button>
              {opts.mkts.map((v) => <button key={v} onClick={() => setMkt(v)} style={chip(mkt === v)}>{cap(v)}</button>)}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gap: 14 }} className="g4">
        {filtered.map((p: any, i: number) => (
          <div key={i} style={{ ...card, position: 'relative', display: 'flex', flexDirection: 'column', ...(p.hot ? { border: `1.5px solid color-mix(in srgb,${GOLD} 60%,var(--line))` } : {}) }}>
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
            </div>
            {/* Sellos */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
              {[[p.no_martingale, es ? 'Sin martingala' : 'No martingale'], [p.no_hft, es ? 'Sin alta frec.' : 'No HFT'], [p.has_sl, 'Stop Loss'], [p.news, es ? 'Noticias' : 'News']].filter(([ok]: any) => ok).map(([, l]: any, k) => (
                <span key={k} style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--green)', background: 'color-mix(in srgb,var(--green) 10%,transparent)', border: '1px solid color-mix(in srgb,var(--green) 30%,transparent)', borderRadius: 99, padding: '2px 7px' }}>✓ {l}</span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--brand)', border: '1px solid color-mix(in srgb,var(--brand) 30%,transparent)', borderRadius: 6, padding: '2px 6px' }}>{p.plat}</span>
              <b style={{ fontSize: 15 }}>{p.price}<small className="muted" style={{ fontSize: 11, fontWeight: 600 }}>{p.unit}</small></b>
            </div>
            <Link href="/dashboard/bot-lab" style={{ display: 'block', marginTop: 10, textAlign: 'center', fontSize: 12.5, fontWeight: 800, padding: '9px', borderRadius: 9, background: 'var(--brand)', color: '#0b1020' }}>{es ? 'Ver robot' : 'View robot'}</Link>
          </div>
        ))}
      </div>
      {!filtered.length && <p className="muted" style={{ fontSize: 13, textAlign: 'center', marginTop: 16 }}>{es ? 'Ningún robot con esos filtros. Prueba otra combinación.' : 'No robots match those filters. Try another combination.'}</p>}
    </div>
  );
}
