'use client';
import { useEffect, useMemo, useState } from 'react';
import { toast, toastErr } from '@/lib/toast';
import { BLOCKS, computeSpace, candidatesToCsv } from '@/lib/stratgen';

// ============================================================
// Onyx Bot Factory · Popup del generador de estrategias (Fase 4B)
// Eliges bloques (indicadores, reglas, sesiones, TP, SL, BE, trailing);
// se calcula cuántas combinaciones hay y se genera un lote de candidatos que
// exportas a MetaTrader para backtestear; luego el laboratorio los filtra.
// ============================================================

// Paleta FRESCA "Laguna" (teal · aqua · lima · coral) — igual que toda la fábrica.
const VIOLET = '#0fb8a6' /*teal*/, GREEN = '#5bd11e' /*lima*/, BLUE = '#2ee6c5' /*aqua*/, AQUA = '#2ee6c5', CORAL = '#ff8a5c';
const inp: any = { padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 13.5 };
function btn(c: string): any { return { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 13, border: `1px solid color-mix(in srgb,${c} 45%,transparent)`, background: `color-mix(in srgb,${c} 14%,transparent)`, color: c }; }

function download(name: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function StratGenerator({ es, post, onClose, initialCfg, symbol = '', tf = '', family = '', reload, blocks = [] }: any) {
  const [cfg, setCfg] = useState<Record<string, string[]>>(initialCfg && Object.keys(initialCfg).length ? initialCfg : {
    indicators: ['ema', 'rsi'], entry: ['cross_up', 'cross_dn'], exit: ['opp_signal', 'fixed'],
    sessions: ['london', 'ny', 'overlap'], tp: ['40', '60', 'atr2'], sl: ['30', '50', 'atr15'], be: ['off', 'be20'], trailing: ['off', 't30'],
  });
  // Si llega una plantilla nueva desde el Constructor, cárgala.
  useEffect(() => { if (initialCfg && Object.keys(initialCfg).length) setCfg(initialCfg); }, [initialCfg]);
  const [n, setN] = useState(2000);
  const [genDir, setGenDir] = useState<'both' | 'long' | 'short'>('both');
  const [busy, setBusy] = useState(false);
  const [cands, setCands] = useState<any[] | null>(null);

  // Arrastrar el popup por la cabecera.
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<null | { sx: number; sy: number; ox: number; oy: number }>(null);
  useEffect(() => {
    if (!drag) return;
    const pt = (e: any) => (e.touches ? e.touches[0] : e);
    const mv = (e: any) => { const p = pt(e); setPos({ x: drag.ox + (p.clientX - drag.sx), y: drag.oy + (p.clientY - drag.sy) }); };
    const up = () => setDrag(null);
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', mv, { passive: false }); window.addEventListener('touchend', up);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); window.removeEventListener('touchmove', mv); window.removeEventListener('touchend', up); };
  }, [drag]);
  const startDrag = (e: any) => { const p = e.touches ? e.touches[0] : e; setDrag({ sx: p.clientX, sy: p.clientY, ox: pos.x, oy: pos.y }); };

  const space = useMemo(() => computeSpace(cfg), [cfg]);
  const toggle = (bk: string, id: string) => setCfg((c) => { const cur = c[bk] || []; return { ...c, [bk]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] }; });

  async function generate() {
    setBusy(true); setCands(null);
    try { const j = await post({ action: 'gen_run', config: cfg, n }); setCands((j.candidates || []).map((c: any) => ({ ...c, dir: genDir }))); toast(es ? `Generadas ${j.sampled} estrategias` : `Generated ${j.sampled} strategies`); }
    catch (e: any) { toastErr(e?.message); } finally { setBusy(false); }
  }

  // Bloques personalizados creados por Claude.
  const [bOpen, setBOpen] = useState(false);
  const [bIntent, setBIntent] = useState('');
  const [bBusy, setBBusy] = useState(false);
  const [bRes, setBRes] = useState<any[] | null>(null);
  async function claudeBlocks() {
    setBBusy(true); setBRes(null);
    try { const j = await post({ action: 'block_ai', intent: bIntent, lang: es ? 'es' : 'en' }); setBRes(j.blocks || []); if (!(j.blocks || []).length) toastErr(es ? 'Claude no devolvió bloques (¿ANTHROPIC_API_KEY?).' : 'Claude returned no blocks (ANTHROPIC_API_KEY?).'); }
    catch (e: any) { toastErr(e?.message); } finally { setBBusy(false); }
  }
  async function saveBlockRule(r: any) {
    try { await post({ action: 'block_save', es: r.es, en: r.en, dsl: r.dsl, origin: 'ai' }); toast(es ? 'Bloque guardado' : 'Block saved'); if (reload) reload(); }
    catch (e: any) { toastErr(e?.message); }
  }
  const dslText = (d: any) => (d?.conds || []).map((c: any) => `${c.ind}.${c.field} ${c.op} ${c.level}`).join(' & ') + ` → ${d?.dir}`;

  // Guarda la selección actual de bloques como plantilla reutilizable.
  async function saveAsTemplate() {
    const suggested = `${symbol || 'Plantilla'} · ${tf || ''} · ${family || ''}`.trim();
    const name = (typeof window !== 'undefined' ? window.prompt(es ? 'Nombre de la plantilla:' : 'Template name:', suggested) : suggested) || '';
    if (!name.trim()) return;
    try { await post({ action: 'template_save', name: name.trim(), symbol, timeframe: tf, family, config: cfg, origin: 'custom' }); toast(es ? 'Plantilla guardada' : 'Template saved'); if (reload) reload(); }
    catch (e: any) { toastErr(e?.message); }
  }

  const spaceTxt = space >= 1e9 ? (space / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' M' : space.toLocaleString('en-US');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(6,9,18,.7)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(860px,100%)', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden', margin: 'auto', transform: `translate(${pos.x}px, ${pos.y}px)`, boxShadow: '0 24px 70px rgba(0,0,0,.55)' }}>
        {/* Cabecera iluminada · arrastrable */}
        <div onMouseDown={startDrag} onTouchStart={startDrag} style={{ padding: '16px 20px', background: 'linear-gradient(135deg, color-mix(in srgb,' + VIOLET + ' 22%,var(--card)), var(--card))', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'move', userSelect: 'none', touchAction: 'none' }}>
          <span style={{ fontSize: 18, color: 'var(--mut)' }}>⠿</span>
          <span style={{ fontSize: 22 }}>🧬</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{es ? 'Generador de estrategias' : 'Strategy generator'}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>{es ? 'Arrastra desde aquí · genera millones de combinaciones y expórtalas a MetaTrader.' : 'Drag from here · generate millions of combinations and export to MetaTrader.'}</div>
          </div>
          <button onMouseDown={(e) => e.stopPropagation()} onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--mut)', fontSize: 20, cursor: 'pointer' }}>✕</button>
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

          {/* Bloques personalizados de Claude */}
          <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13.5, fontWeight: 800 }}>✨ {es ? 'Bloques de entrada de Claude' : 'Claude entry blocks'}</div>
              <span className="muted" style={{ fontSize: 11 }}>· {es ? 'reglas nuevas ejecutables por el motor' : 'new engine-executable rules'}</span>
              <button onClick={() => setBOpen((v) => !v)} style={{ ...btn(CORAL), marginLeft: 'auto', padding: '6px 11px' }}>{bOpen ? (es ? 'Cerrar' : 'Close') : (es ? '✨ Crear bloque' : '✨ Create block')}</button>
            </div>
            {(blocks as any[]).length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: bOpen ? 10 : 0 }}>
                {(blocks as any[]).map((bl) => { const on = (cfg.entry || []).includes(bl.block_id); return (
                  <button key={bl.id} onClick={() => toggle('entry', bl.block_id)} title={dslText(bl.dsl)} style={{ padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${on ? VIOLET : 'var(--line)'}`, background: on ? `color-mix(in srgb,${VIOLET} 16%,transparent)` : 'transparent', color: on ? VIOLET : 'var(--tx)' }}>{es ? bl.es : bl.en}</button>
                ); })}
              </div>
            )}
            {!(blocks as any[]).length && !bOpen && <div className="muted" style={{ fontSize: 11.5 }}>{es ? 'Aún no hay bloques. Pulsa “Crear bloque” y describe la idea.' : 'No blocks yet. Press “Create block” and describe the idea.'}</div>}
            {bOpen && (
              <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 12 }}>
                <textarea value={bIntent} onChange={(e) => setBIntent(e.target.value)} rows={2} placeholder={es ? 'Ej: entrar largo cuando RSI cruza 40 al alza y ADX sube' : 'e.g. go long when RSI crosses above 40 and ADX rising'} style={{ ...inp, width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
                <button onClick={claudeBlocks} disabled={bBusy} style={{ ...btn(CORAL), marginTop: 8 }}>{bBusy ? (es ? 'Pensando…' : 'Thinking…') : (es ? '✨ Proponer bloques' : '✨ Propose blocks')}</button>
                {bRes && bRes.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                    <b style={{ fontSize: 12.5 }}>{es ? r.es : r.en}</b>
                    <span className="muted" style={{ fontSize: 11, fontFamily: 'monospace' }}>{dslText(r.dsl)}</span>
                    <button onClick={() => saveBlockRule(r)} style={{ ...btn(GREEN), marginLeft: 'auto', padding: '5px 10px' }}>{es ? 'Guardar' : 'Save'}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Contador + acciones */}
        <div style={{ padding: 18, borderTop: '1px solid var(--line)', background: 'var(--bg2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <div className="muted" style={{ fontSize: 11.5 }}>{es ? 'Combinaciones posibles' : 'Possible combinations'}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: VIOLET, lineHeight: 1 }}>{spaceTxt}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="muted" style={{ fontSize: 12 }}>{es ? 'Dirección' : 'Direction'}</span>
              <select value={genDir} onChange={(e) => setGenDir(e.target.value as any)} style={{ ...inp, padding: '7px 9px' }}>
                <option value="both">{es ? 'Ambos' : 'Both'}</option>
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
              <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>{es ? 'Generar' : 'Generate'}</span>
              <input type="number" value={n} min={100} max={20000} onChange={(e) => setN(Math.max(100, Math.min(20000, Number(e.target.value) || 100)))} style={{ ...inp, width: 90 }} />
              <span className="muted" style={{ fontSize: 12 }}>{es ? 'candidatos' : 'candidates'}</span>
            </div>
            <button onClick={saveAsTemplate} style={{ ...btn(GREEN), marginLeft: 'auto' }}>{es ? '💾 Guardar como plantilla' : '💾 Save as template'}</button>
            <button onClick={generate} disabled={busy || space < 1} style={{ padding: '11px 20px', borderRadius: 11, border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer', background: 'linear-gradient(135deg,' + VIOLET + ',' + AQUA + ')', color: '#04201d', opacity: busy || space < 1 ? 0.6 : 1 }}>{busy ? (es ? 'Generando…' : 'Generating…') : (es ? '⚡ Generar lote' : '⚡ Generate batch')}</button>
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
