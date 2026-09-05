'use client';
import { useEffect, useState } from 'react';
import { toast, toastErr } from '@/lib/toast';

// ============================================================
// Onyx Bot Factory · Pipeline de 6 meses en demo (Fase 3)
// Tablero por etapas con anillos y semáforo automático + correlación.
// ============================================================

const GREEN = '#1D9E75', AMBER = '#EF9F27', ORANGE = '#D85A30', RED = '#E24B4A', VIOLET = '#a06bff', GOLD = '#ffd45e';
const card: any = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 };
const inp: any = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 13.5 };
function btn(c: string): any { return { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 13, border: `1px solid color-mix(in srgb,${c} 45%,transparent)`, background: `color-mix(in srgb,${c} 14%,transparent)`, color: c }; }
function healthColor(h: string) { return h === 'green' ? GREEN : h === 'yellow' ? AMBER : ORANGE; }
function corrColor(v: number) { const a = Math.abs(v); return a >= 0.7 ? RED : a >= 0.4 ? AMBER : a >= 0.2 ? '#9FE1CB' : GREEN; }

function Ring({ score, color, size = 96, label }: any) {
  const r = size * 0.4, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={size * 0.11} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={size * 0.11} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dashoffset .7s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.28, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        {label && <span className="muted" style={{ fontSize: size * 0.1 }}>{label}</span>}
      </div>
    </div>
  );
}

export default function FactoryPipeline({ es, canManage, post }: any) {
  const [d, setD] = useState<any>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [magic, setMagic] = useState('');

  async function load() { try { const j = await post({ action: 'pipeline' }); setD(j); } catch (e: any) { toastErr(e?.message); } }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  if (!d) return <div className="muted" style={{ padding: 20 }}>{es ? 'Cargando…' : 'Loading…'}</div>;
  const stages = d.stages || [];
  const cols: [string, string][] = [...stages.map((s: any) => [s.key, es ? s.es : s.en]), ['listo', es ? 'Listo para real' : 'Real-ready'], ['real', es ? 'Cuenta real' : 'Live']];
  const bots = (d.bots || []) as any[];
  const byStage = (k: string) => bots.filter((b) => b.stage === k && b.status !== 'archivado');
  const archived = bots.filter((b) => b.status === 'archivado' || b.stage === 'archived');
  const bot = bots.find((b) => b.id === sel);

  async function run() { setBusy(true); try { const r = await post({ action: 'pipeline_run' }); toast((es ? 'Evaluados: ' : 'Evaluated: ') + (r.evaluated || 0)); await load(); } catch (e: any) { toastErr(e?.message); } finally { setBusy(false); } }
  async function act(body: any, ok?: string) { setBusy(true); try { await post(body); if (ok) toast(ok); await load(); } catch (e: any) { toastErr(e?.message); } finally { setBusy(false); } }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3 style={{ margin: 0 }}>{es ? 'Pipeline de validación · 6 meses en demo' : 'Validation pipeline · 6 months on demo'}</h3>
            <p className="muted" style={{ fontSize: 13, margin: '4px 0 0' }}>{es ? 'Automático: cada noche recalcula el score, aplica el semáforo y avanza o archiva. Verde = normal · amarillo = mitad de riesgo · naranja = paper.' : 'Automatic: each night it recomputes score, applies the traffic light and advances or archives. Green = normal · yellow = half risk · orange = paper.'}</p>
          </div>
          {canManage && <button onClick={run} disabled={busy} style={btn(VIOLET)}>{busy ? '…' : (es ? 'Ejecutar ahora' : 'Run now')}</button>}
        </div>

        {/* Tablero de etapas */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length},minmax(150px,1fr))`, gap: 10, marginTop: 16, overflowX: 'auto' }}>
          {cols.map(([k, lbl], i) => {
            const list = byStage(k);
            const st = stages[i];
            const accent = k === 'real' ? GOLD : k === 'listo' ? BLUEACCENT : VIOLET;
            return (
              <div key={k} style={{ background: 'var(--bg2)', borderRadius: 12, padding: 10, minHeight: 120, borderTop: `3px solid ${accent}` }}>
                <div style={{ fontSize: 12.5, fontWeight: 800 }}>{i + 1 <= stages.length ? `${i + 1}. ` : ''}{lbl}</div>
                {st && <div className="muted" style={{ fontSize: 10.5, marginBottom: 6 }}>{st.days}d · filtro {st.gate}</div>}
                {!st && <div className="muted" style={{ fontSize: 10.5, marginBottom: 6 }}>&nbsp;</div>}
                <div style={{ display: 'grid', gap: 6 }}>
                  {list.map((b) => (
                    <button key={b.id} onClick={() => setSel(b.id)} style={{ textAlign: 'left', cursor: 'pointer', padding: '7px 9px', borderRadius: 9, border: `1px solid ${sel === b.id ? 'var(--brand)' : 'var(--line)'}`, background: sel === b.id ? 'color-mix(in srgb,var(--brand) 12%,transparent)' : 'var(--card)', color: 'var(--tx)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: b.paper ? ORANGE : healthColor(b.health || 'green'), flex: 'none' }} />
                        <b style={{ fontSize: 11.5, fontFamily: 'monospace', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name?.replace('ONYX-', '')}</b>
                        {k !== 'listo' && k !== 'real' && <span style={{ fontSize: 11, fontWeight: 800, color: (b.score || 0) >= (st?.gate || 60) ? GREEN : AMBER }}>{b.score || 0}</span>}
                      </div>
                    </button>
                  ))}
                  {!list.length && <div className="muted" style={{ fontSize: 11 }}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
        {archived.length > 0 && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>🗑 {archived.length} {es ? 'archivados (no pasaron el filtro)' : 'archived (failed the filter)'}</div>}
      </div>

      {/* Detalle del robot */}
      {bot && (
        <div style={{ ...card, borderColor: `color-mix(in srgb,${healthColor(bot.health || 'green')} 40%,var(--line))` }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Semáforo grande */}
            <div style={{ textAlign: 'center' }}>
              <Ring score={bot.score || 0} color={bot.paper ? ORANGE : healthColor(bot.health || 'green')} label="score" />
              <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 800, color: bot.paper ? ORANGE : healthColor(bot.health || 'green') }}>
                {bot.paper ? (es ? 'PAPER (naranja)' : 'PAPER (orange)') : bot.health === 'yellow' ? (es ? 'AMARILLO · ½ riesgo' : 'YELLOW · ½ risk') : bot.health === 'orange' ? 'NARANJA' : (es ? 'VERDE · todo bien' : 'GREEN · all good')}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 17, fontWeight: 800, fontFamily: 'monospace', color: VIOLET }}>{bot.name}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{String(bot.platform || '').toUpperCase()} · {bot.symbol || '—'} · {bot.timeframe || '—'} · {es ? 'etapa' : 'stage'} {bot.stage}</div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
                {[[es ? 'Riesgo' : 'Risk', `${Math.round((bot.risk_factor ?? 1) * 100)}%`, (bot.risk_factor ?? 1) < 1 ? AMBER : GREEN], [es ? 'Robustez' : 'Robustness', bot.robustness_verdict || '—', bot.robustness_verdict === 'robusto' ? GREEN : bot.robustness_verdict === 'moderado' ? AMBER : RED], [es ? 'Corr. máx' : 'Max corr', bot.max_corr != null ? bot.max_corr : '—', bot.max_corr != null && Math.abs(bot.max_corr) > 0.7 ? RED : GREEN]].map(([l, v, c]: any) => (
                  <div key={l} style={{ background: 'var(--bg2)', borderRadius: 9, padding: '7px 11px', textAlign: 'center', minWidth: 84 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: c, textTransform: 'capitalize' }}>{v}</div>
                    <div className="muted" style={{ fontSize: 10.5 }}>{l}</div>
                  </div>
                ))}
              </div>
              {bot.corr_with && bot.max_corr != null && Math.abs(bot.max_corr) > 0.7 && <div style={{ fontSize: 12, color: AMBER, marginTop: 8 }}>⚠ {es ? 'Muy correlacionado con' : 'Highly correlated with'} {bot.corr_with} — {es ? 'exposición reducida automáticamente.' : 'exposure auto-reduced.'}</div>}
            </div>
          </div>

          {/* Conectar a demo (si aún no corre) */}
          {canManage && bot.live_magic == null && (
            <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg2)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{es ? 'Conéctalo a la cuenta demo:' : 'Connect to demo account:'}</div>
              <input value={magic} onChange={(e) => setMagic(e.target.value)} placeholder={es ? 'Magic del robot (9 dígitos)' : 'Robot magic'} style={{ ...inp, maxWidth: 220 }} />
              <button onClick={() => { if (!magic) { toastErr(es ? 'Escribe el magic.' : 'Enter magic.'); return; } act({ action: 'link_demo', botId: bot.id, magic: Number(magic) }, es ? 'Conectado · pipeline iniciado' : 'Connected · pipeline started'); setMagic(''); }} disabled={busy} style={btn(GREEN)}>{es ? 'Conectar' : 'Connect'}</button>
            </div>
          )}

          {/* Controles */}
          {canManage && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {bot.real_ready && !bot.real_approved && <button onClick={() => act({ action: 'approve_real', botId: bot.id }, es ? 'Aprobado a cuenta real' : 'Approved to live')} style={{ ...btn(GOLD), padding: '11px 18px', fontSize: 14 }}>{es ? '🚀 Aprobar a cuenta real (1 clic)' : '🚀 Approve to live (1 click)'}</button>}
              {bot.real_approved && <span style={{ fontSize: 13, fontWeight: 800, color: GOLD }}>★ {es ? 'En cuenta real' : 'Live'}</span>}
              {bot.live_magic != null && bot.stage !== 'real' && <>
                <button onClick={() => act({ action: 'stage_override', botId: bot.id, dir: 'advance' }, es ? 'Avanzado' : 'Advanced')} disabled={busy} style={btn('var(--brand)')}>{es ? 'Forzar avance' : 'Force advance'}</button>
                <button onClick={() => act({ action: 'stage_override', botId: bot.id, dir: 'archive' }, es ? 'Archivado' : 'Archived')} disabled={busy} style={btn(RED)}>{es ? 'Archivar' : 'Archive'}</button>
              </>}
            </div>
          )}
        </div>
      )}

      {/* Matriz de correlación */}
      {d.corr && d.corr.names && d.corr.names.length >= 2 && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>{es ? 'Correlación entre robots activos' : 'Correlation between active robots'}</h3>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>{es ? 'Verde = se diversifican · rojo = hacen lo mismo (riesgo apilado). El semáforo reduce la exposición cuando dos superan 0.7.' : 'Green = diversify · red = redundant (stacked risk). The traffic light reduces exposure when two exceed 0.7.'}</p>
          <CorrMatrix corr={d.corr} />
        </div>
      )}
    </div>
  );
}

const BLUEACCENT = '#38d9ff';

function CorrMatrix({ corr }: any) {
  const names = corr.names as { id: string; name: string }[];
  const val = (a: string, b: string) => { if (a === b) return 1; const m = corr.matrix.find((x: any) => (x.a === a && x.b === b) || (x.a === b && x.b === a)); return m ? m.v : 0; };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 4 }}>
        <tbody>
          <tr><td></td>{names.map((c) => <td key={c.id} style={{ fontSize: 10.5, color: 'var(--mut)', textAlign: 'center' }}>{c.name.replace('ONYX-', '').slice(0, 8)}</td>)}</tr>
          {names.map((r) => (
            <tr key={r.id}>
              <td style={{ fontSize: 10.5, color: 'var(--mut)', textAlign: 'right', paddingRight: 6, whiteSpace: 'nowrap' }}>{r.name.replace('ONYX-', '')}</td>
              {names.map((c) => { const v = val(r.id, c.id); const same = r.id === c.id; return (
                <td key={c.id} style={{ width: 52, height: 40, borderRadius: 7, textAlign: 'center', verticalAlign: 'middle', fontSize: 12, fontWeight: 700, background: same ? 'var(--bg2)' : corrColor(v), color: same ? 'var(--mut)' : '#0b1020' }}>{same ? '—' : v.toFixed(2)}</td>
              ); })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
