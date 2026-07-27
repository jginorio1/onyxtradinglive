'use client';
import { toast } from '@/lib/toast';
import { useEffect, useState } from 'react';
import { errMsg } from '@/lib/i18nErrors';

type Lang = 'es' | 'en';

const T: any = {
  es: {
    title: 'Mi reto', sub: 'Mira en vivo si sigues cumpliendo las reglas de tu prop firm.',
    locked: 'Onyx Guardian (incluido en planes superiores) activa tu marcador del reto.',
    none: 'Enciende "Medir mi reto" en una cuenta para ver su marcador.',
    on: 'Medir mi reto', firm: 'Prop firm', phase: 'Fase', ph1: 'Fase 1', ph2: 'Fase 2', phf: 'Fondeada',
    dloss: 'Pérdida diaria', tloss: 'Pérdida máx. total', target: 'Objetivo de ganancia',
    mindays: 'Días mínimos', consist: 'Consistencia (máx % de un día)', base: 'Se mide sobre', reset: 'Hora de reinicio del día',
    weekend: 'Cerrar antes del fin de semana', save: 'Guardar reglas', saved: 'Reglas guardadas',
    baseDSB: 'Balance al inicio del día', baseDSE: 'Equity al inicio del día', baseInit: 'Balance inicial',
    onTrack: 'En camino', watch: 'Vigila', breach: 'Regla rota',
    closest: 'Lo más cerca de romperse', note: 'Estimación según las reglas que cargaste. Confírmalas con tu contrato; no es la norma oficial de la firma. Para BLOQUEAR de verdad, activa los límites en Onyx Guardian.',
    editRules: 'Reglas del reto',
  },
  en: {
    title: 'My challenge', sub: 'See in real time whether you still meet your prop-firm rules.',
    locked: 'Onyx Guardian (included in higher plans) unlocks your challenge scoreboard.',
    none: 'Turn on "Track my challenge" for an account to see its scoreboard.',
    on: 'Track my challenge', firm: 'Prop firm', phase: 'Phase', ph1: 'Phase 1', ph2: 'Phase 2', phf: 'Funded',
    dloss: 'Daily loss', tloss: 'Max total loss', target: 'Profit target',
    mindays: 'Minimum days', consist: 'Consistency (max % of one day)', base: 'Measured on', reset: 'Day reset hour',
    weekend: 'Flat before weekend', save: 'Save rules', saved: 'Rules saved',
    baseDSB: 'Day-start balance', baseDSE: 'Day-start equity', baseInit: 'Initial balance',
    onTrack: 'On track', watch: 'Watch', breach: 'Rule broken',
    closest: 'Closest to breaking', note: 'Estimate based on the rules you entered. Confirm them with your contract; it is not the firm official rule. To actually BLOCK, enable limits in Onyx Guardian.',
    editRules: 'Challenge rules',
  },
};

const STCOL: any = { ok: 'var(--green)', watch: 'var(--amber)', breach: 'var(--red)', na: 'var(--mut)' };

export default function Challenge({ lang }: { lang: Lang }) {
  const L = T[lang];
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [draft, setDraft] = useState<any>({});   // account_id -> rules en edición

  useEffect(() => { load(); }, []);
  async function load() {
    try {
      const r = await fetch('/api/challenge'); const j = await r.json();
      setData(j);
      const d: any = {};
      (j.accounts || []).forEach((a: any) => { d[a.id] = { ...a.rules }; });
      setDraft(d);
    } catch { setData({ boards: [], accounts: [] }); }
  }
  const boardFor = (id: string) => (data?.boards || []).find((b: any) => b.accountId === id);

  function applyFirm(id: string, firmId: string) {
    const f = (data?.firms || []).find((x: any) => x.id === firmId);
    setDraft((p: any) => ({ ...p, [id]: {
      ...p[id], firm: firmId,
      ...(f ? { daily_loss: f.daily_loss, daily_loss_pct: true, total_loss: f.total_loss, total_loss_pct: true,
        base: f.base, reset_hour: f.reset_hour, profit_target: f.profit_target, profit_target_pct: true,
        min_days: f.min_days, consistency: f.consistency } : {}),
    } }));
  }
  function setF(id: string, k: string, v: any) { setDraft((p: any) => ({ ...p, [id]: { ...p[id], [k]: v } })); }

  async function save(id: string) {
    setBusy(id);
    const r = await fetch('/api/challenge', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account_id: id, ...draft[id] }) });
    const j = await r.json().catch(() => ({})); setBusy('');
    if (!r.ok) { toast(errMsg(j, lang)); return; }
    toast(L.saved, 'ok'); load();
  }

  if (!data) return <div className="card muted">…</div>;
  if (data.locked || data.code === 'no_plan') {
    return <div style={{ maxWidth: 820, margin: '0 auto' }}><div className="card muted" style={{ textAlign: 'center', padding: 28 }}>🔒 {L.locked}</div></div>;
  }

  const lbl = { fontSize: 11.5, color: 'var(--mut)', display: 'block', marginBottom: 3 } as any;
  const unitSel = (id: string, key: string) => (
    <select value={draft[id]?.[key] ? '%' : '$'} onChange={(e) => setF(id, key, e.target.value === '%')} style={{ margin: 0, width: 58, padding: '6px 4px' }}>
      <option value="%">%</option><option value="$">$</option>
    </select>
  );

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ textAlign: 'center', marginBottom: 2 }}>
        <span style={{ display: 'inline-flex', width: 44, height: 44, borderRadius: 13, background: 'rgba(124,140,255,.16)', alignItems: 'center', justifyContent: 'center', fontSize: 21, marginBottom: 8 }}>🏁</span>
        <h2 style={{ fontSize: 20, marginBottom: 2 }}>{L.title}</h2>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>{L.sub}</p>
      </div>

      {!data.accounts?.length && <div className="card muted">{L.none}</div>}

      {(data.accounts || []).map((a: any) => {
        const d = draft[a.id] || {};
        const board = boardFor(a.id);
        const vpill = board ? (board.verdict === 'breach' ? { t: L.breach, c: 'var(--red)', bg: 'rgba(255,107,125,.15)' }
          : board.verdict === 'watch' ? { t: L.watch, c: 'var(--amber)', bg: 'rgba(255,192,77,.15)' }
          : { t: L.onTrack, c: 'var(--green)', bg: 'rgba(52,226,160,.15)' }) : null;
        return (
          <div key={a.id} className="card">
            <div className="row between" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <b style={{ fontSize: 15 }}>{a.name} <span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>· #{a.login}</span></b>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                {vpill && <span className="pill" style={{ color: vpill.c, background: vpill.bg }}>{vpill.t}</span>}
                <label className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={!!d.on} onChange={(e) => setF(a.id, 'on', e.target.checked)} style={{ width: 'auto', margin: 0 }} /> {L.on}
                </label>
              </div>
            </div>

            {/* Marcador en vivo */}
            {board && board.rules?.length > 0 && (
              <div style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 11 }}>
                {board.rules.map((r: any) => (
                  <div key={r.key}>
                    <div className="row between" style={{ fontSize: 13, marginBottom: 4 }}>
                      <span>{lang === 'es' ? r.es : r.en}</span>
                      <span style={{ color: STCOL[r.status] }}>{lang === 'es' ? r.valEs : r.valEn}</span>
                    </div>
                    <div style={{ height: 7, background: 'var(--bg2)', borderRadius: 20, overflow: 'hidden' }}>
                      <div style={{ width: Math.max(0, Math.min(100, r.pct)) + '%', height: '100%', background: STCOL[r.status], borderRadius: 20 }} />
                    </div>
                  </div>
                ))}
                {board.closest && board.verdict !== 'on_track' && (
                  <div style={{ fontSize: 12.5, color: 'var(--amber)' }}>🔥 {L.closest}: {lang === 'es' ? board.closest.es : board.closest.en}</div>
                )}
              </div>
            )}

            {/* Editor de reglas */}
            {d.on && (
              <div style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>{L.editRules}</div>
                <div className="grid g3" style={{ gap: 10 }}>
                  <div>
                    <span style={lbl}>{L.firm}</span>
                    <select value={d.firm || 'custom'} onChange={(e) => applyFirm(a.id, e.target.value)} style={{ margin: 0 }}>
                      {(data.firms || []).map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <span style={lbl}>{L.phase}</span>
                    <select value={d.phase || '1'} onChange={(e) => setF(a.id, 'phase', e.target.value)} style={{ margin: 0 }}>
                      <option value="1">{L.ph1}</option><option value="2">{L.ph2}</option><option value="funded">{L.phf}</option>
                    </select>
                  </div>
                  <div>
                    <span style={lbl}>{L.base}</span>
                    <select value={d.base || 'day_start_balance'} onChange={(e) => setF(a.id, 'base', e.target.value)} style={{ margin: 0 }}>
                      <option value="day_start_balance">{L.baseDSB}</option>
                      <option value="day_start_equity">{L.baseDSE}</option>
                      <option value="initial_balance">{L.baseInit}</option>
                    </select>
                  </div>
                  <div>
                    <span style={lbl}>{L.dloss}</span>
                    <div className="row" style={{ gap: 6 }}><input type="number" value={d.daily_loss ?? 0} onChange={(e) => setF(a.id, 'daily_loss', Number(e.target.value))} style={{ margin: 0 }} />{unitSel(a.id, 'daily_loss_pct')}</div>
                  </div>
                  <div>
                    <span style={lbl}>{L.tloss}</span>
                    <div className="row" style={{ gap: 6 }}><input type="number" value={d.total_loss ?? 0} onChange={(e) => setF(a.id, 'total_loss', Number(e.target.value))} style={{ margin: 0 }} />{unitSel(a.id, 'total_loss_pct')}</div>
                  </div>
                  <div>
                    <span style={lbl}>{L.target}</span>
                    <div className="row" style={{ gap: 6 }}><input type="number" value={d.profit_target ?? 0} onChange={(e) => setF(a.id, 'profit_target', Number(e.target.value))} style={{ margin: 0 }} />{unitSel(a.id, 'profit_target_pct')}</div>
                  </div>
                  <div>
                    <span style={lbl}>{L.mindays}</span>
                    <input type="number" value={d.min_days ?? 0} onChange={(e) => setF(a.id, 'min_days', Number(e.target.value))} style={{ margin: 0 }} />
                  </div>
                  <div>
                    <span style={lbl}>{L.consist}</span>
                    <input type="number" value={d.consistency ?? 0} onChange={(e) => setF(a.id, 'consistency', Number(e.target.value))} style={{ margin: 0 }} />
                  </div>
                  <div>
                    <span style={lbl}>{L.reset}</span>
                    <input type="number" value={d.reset_hour ?? 0} onChange={(e) => setF(a.id, 'reset_hour', Number(e.target.value))} style={{ margin: 0 }} />
                  </div>
                </div>
                <label className="row" style={{ gap: 8, marginTop: 10, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={!!d.no_weekend_hold} onChange={(e) => setF(a.id, 'no_weekend_hold', e.target.checked)} style={{ width: 'auto', margin: 0 }} /> {L.weekend}
                </label>
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={() => save(a.id)} disabled={busy === a.id}>{busy === a.id ? '…' : L.save}</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.5, textAlign: 'center' }}>ℹ️ {L.note}</p>
    </div>
  );
}
