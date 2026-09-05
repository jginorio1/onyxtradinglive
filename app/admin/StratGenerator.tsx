'use client';
import { useMemo, useState } from 'react';
import { toast, toastErr } from '@/lib/toast';
import { BLOCKS, computeSpace, candidatesToCsv } from '@/lib/stratgen';

// ============================================================
// Onyx Bot Factory · Popup del generador de estrategias (Fase 4B)
// Eliges bloques (indicadores, reglas, sesiones, TP, SL, BE, trailing);
// se calcula cuántas combinaciones hay y se genera un lote de candidatos que
// exportas a MetaTrader para backtestear; luego el laboratorio los filtra.
// ============================================================

const VIOLET = '#a06bff', GREEN = '#1D9E75', BLUE = '#378ADD';
const inp: any = { padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 13.5 };
function btn(c: string): any { return { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 13, border: `1px solid color-mix(in srgb,${c} 45%,transparent)`, background: `color-mix(in srgb,${c} 14%,transparent)`, color: c }; }

function download(name: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function StratGenerator({ es, post, onClose }: any) {
  const [cfg, setCfg] = useState<Record<string, string[]>>({
    indicators: ['ema', 'rsi'], entry: ['cross_up', 'cross_dn'], exit: ['opp_signal', 'fixed'],
    sessions: ['london', 'ny', 'overlap'], tp: ['40', '60', 'atr2'], sl: ['30', '50', 'atr15'], be: ['off', 'be20'], trailing: ['off', 't30'],
  });
  const [n, setN] = useState(2000);
  const [busy, setBusy] = useState(false);
  const [cands, setCands] = useState<any[] | null>(null);

  const space = useMemo(() => computeSpace(cfg), [cfg]);
  const toggle = (bk: string, id: string) => setCfg((c) => { const cur = c[bk] || []; return { ...c, [bk]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] }; });

  async function generate() {
    setBusy(true); setCands(null);
    try { const j = await post({ action: 'gen_run', config: cfg, n }); setCands(j.candidates || []); toast(es ? `Generadas ${j.sampled} estrategias` : `Generated ${j.sampled} strategies`); }
    catch (e: any) { toastErr(e?.message); } finally { setBusy(false); }
  }

  const spaceTxt = space >= 1e9 ? (space / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' M' : space.toLocaleString('en-US');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(6,9,18,.7)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(860px,100%)', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden', margin: 'auto' }}>
        {/* Cabecera iluminada */}
        <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, color-mix(in srgb,' + VIOLET + ' 22%,var(--card)), var(--card))', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🧬</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{es ? 'Generador de estrategias' : 'Strategy generator'}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>{es ? 'Elige los bloques; genera millones de combinaciones y expórtalas a MetaTrader.' : 'Pick the blocks; generate millions of combinations and export to MetaTrader.'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--mut)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Bloques */}
        <div style={{ padding: 18, display: 'grid', gap: 14, maxHeight: '60vh', overflowY: 'auto' }}>
          {BLOCKS.map((b) => (
            <div key={b.key}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>{es ? b.es : b.en}</div>
                <span className="muted" style={{ fontSize: 11 }}>· {(cfg[b.key] || []).length} {es ? 'elegidos' : 'chosen'}</span>
                {b.note && b.key === 'indicators' && <span className="muted" style={{ fontSize: 11 }}>· {es ? b.note : 'Combines up to 2–3 per strategy.'}</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {b.opts.map((o) => { const on = (cfg[b.key] || []).includes(o.id); return (
                  <button key={o.id} onClick={() => toggle(b.key, o.id)} style={{ padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${on ? VIOLET : 'var(--line)'}`, background: on ? `color-mix(in srgb,${VIOLET} 16%,transparent)` : 'transparent', color: on ? VIOLET : 'var(--tx)' }}>{es ? o.es : o.en}</button>
                ); })}
              </div>
            </div>
          ))}
        </div>

        {/* Contador + acciones */}
        <div style={{ padding: 18, borderTop: '1px solid var(--line)', background: 'var(--bg2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <div className="muted" style={{ fontSize: 11.5 }}>{es ? 'Combinaciones posibles' : 'Possible combinations'}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: VIOLET, lineHeight: 1 }}>{spaceTxt}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="muted" style={{ fontSize: 12 }}>{es ? 'Generar' : 'Generate'}</span>
              <input type="number" value={n} min={100} max={20000} onChange={(e) => setN(Math.max(100, Math.min(20000, Number(e.target.value) || 100)))} style={{ ...inp, width: 100 }} />
              <span className="muted" style={{ fontSize: 12 }}>{es ? 'candidatos' : 'candidates'}</span>
            </div>
            <button onClick={generate} disabled={busy || space < 1} style={{ marginLeft: 'auto', padding: '11px 20px', borderRadius: 11, border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer', background: 'linear-gradient(135deg,' + VIOLET + ',var(--brand))', color: '#0b1020', opacity: busy || space < 1 ? 0.6 : 1 }}>{busy ? (es ? 'Generando…' : 'Generating…') : (es ? '⚡ Generar lote' : '⚡ Generate batch')}</button>
          </div>

          {cands && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: GREEN }}>✓ {cands.length} {es ? 'estrategias listas' : 'strategies ready'}</span>
                <button onClick={() => download('onyx-estrategias.csv', candidatesToCsv(cands), 'text/csv')} style={btn(BLUE)}>{es ? 'Exportar CSV (MT)' : 'Export CSV (MT)'}</button>
                <button onClick={() => download('onyx-estrategias.json', JSON.stringify(cands, null, 2), 'application/json')} style={btn('var(--brand)')}>{es ? 'Exportar JSON' : 'Export JSON'}</button>
              </div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{es ? 'Cada fila es una estrategia (indicadores, reglas, sesión, TP, SL, BE, trailing). Backtestéalas en el Strategy Tester de MT y sube las buenas al laboratorio para el embudo de robustez.' : 'Each row is a strategy (indicators, rules, session, TP, SL, BE, trailing). Backtest them in MT Strategy Tester and upload the good ones to the lab for the robustness funnel.'}</div>
              <div style={{ marginTop: 10, overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 10 }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 11.5, width: '100%' }}>
                  <thead><tr>{['#', 'ind1', 'ind2', 'entry', 'exit', 'session', 'tp', 'sl', 'be', 'trail'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--line)', color: 'var(--mut)' }}>{h}</th>)}</tr></thead>
                  <tbody>{cands.slice(0, 8).map((c, i) => <tr key={i}>{['id', 'ind1', 'ind2', 'entry', 'exit', 'sessions', 'tp', 'sl', 'be', 'trailing'].map((k, j) => <td key={k} style={{ padding: '5px 8px', fontFamily: j ? 'monospace' : 'inherit' }}>{k === 'id' ? `S${i + 1}` : (c[k] ?? '—')}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
