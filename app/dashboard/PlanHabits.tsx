'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';

type Lang = 'es' | 'en';

const HAB: Record<string, [string, string]> = {
  reviewed_calendar: ['Revisé el calendario económico', 'Reviewed the economic calendar'],
  defined_risk: ['Definí mi riesgo antes de entrar', 'Defined my risk before entering'],
  followed_plan: ['Seguí mi plan de entrada', 'Followed my entry plan'],
  journaled: ['Registré mis operaciones', 'Journaled my trades'],
  stopped_at_limit: ['Cerré al llegar a mi límite', 'Closed at my limit'],
  no_revenge: ['No operé por venganza', 'No revenge trading'],
  respected_sessions: ['Operé solo en mis sesiones', 'Traded only in my sessions'],
};
const SESS: Record<string, [string, string]> = { asia: ['Asia', 'Asia'], london: ['Londres', 'London'], ny: ['Nueva York', 'New York'] };
const STYLES: Record<string, [string, string]> = { day: ['Day trader', 'Day trader'], scalper: ['Scalper', 'Scalper'], swing: ['Swing', 'Swing'], funded: ['Fondeo (prop)', 'Funded (prop)'], crypto: ['Cripto', 'Crypto'], custom: ['Personalizado', 'Custom'] };

// Plantillas por tipo de trader (las reglas se rellenan en el idioma actual).
const PRESETS: Record<string, any> = {
  day: { risk_per_trade: 1, max_daily_loss_pct: 3, max_trades_day: 3, sessions: ['london', 'ny'], habits: ['reviewed_calendar', 'defined_risk', 'followed_plan', 'journaled', 'no_revenge'], rules_es: ['Relación riesgo/beneficio mínima 1:2', 'No mover el stop en contra', 'Parar tras 2 pérdidas seguidas'], rules_en: ['Minimum 1:2 risk/reward', 'Never move stop against me', 'Stop after 2 losses in a row'] },
  scalper: { risk_per_trade: 0.5, max_daily_loss_pct: 2, max_trades_day: 8, sessions: ['london', 'ny'], habits: ['defined_risk', 'followed_plan', 'stopped_at_limit', 'no_revenge', 'respected_sessions'], rules_es: ['Solo con spread bajo', 'Salir en 2R o al invalidarse', 'Nada fuera de mi sesión'], rules_en: ['Only on low spread', 'Exit at 2R or on invalidation', 'Nothing outside my session'] },
  swing: { risk_per_trade: 1, max_daily_loss_pct: 5, max_trades_day: 1, sessions: ['asia', 'london', 'ny'], habits: ['defined_risk', 'followed_plan', 'journaled', 'no_revenge'], rules_es: ['Confirmar en H4/D1', 'Máx. 1 operación por par', 'Sin revisar cada vela'], rules_en: ['Confirm on H4/D1', 'Max 1 trade per pair', 'Do not check every candle'] },
  funded: { risk_per_trade: 0.5, max_daily_loss_pct: 4, max_trades_day: 3, sessions: ['london', 'ny'], habits: ['reviewed_calendar', 'defined_risk', 'followed_plan', 'stopped_at_limit', 'no_revenge'], rules_es: ['Respetar el drawdown de la firma', 'No operar en noticias rojas', 'Parar al llegar al objetivo del día'], rules_en: ['Respect the firm drawdown', 'No trading on red news', 'Stop when the daily target is hit'] },
  crypto: { risk_per_trade: 1, max_daily_loss_pct: 5, max_trades_day: 4, sessions: ['asia', 'london', 'ny'], habits: ['defined_risk', 'followed_plan', 'journaled', 'no_revenge'], rules_es: ['Solo BTC/ETH de alta liquidez', 'Apalancamiento máx. 5x', 'Nada de FOMO en velas verdes'], rules_en: ['Only high-liquidity BTC/ETH', 'Max 5x leverage', 'No FOMO on green candles'] },
};

const T: any = {
  es: { title: 'Mi plan y hábitos', sub: 'Tus reglas, tu check-in diario, y qué tan bien las cumples.',
    adherence: 'Adherencia al plan', streak: 'Días de racha', checkin: 'Check-in de hoy',
    myPlan: 'Mi plan', edit: 'Editar', save: 'Guardar', cancel: 'Cancelar', use: 'Usar plantilla',
    style: 'Estilo', risk: 'Riesgo por operación', ddl: 'Pérdida diaria máx.', maxt: 'Máx. operaciones/día', sessions: 'Sesiones', pairs: 'Pares/mercados', goal: 'Mi objetivo', rules: 'Mis reglas', addRule: 'Añadir regla', habitsSel: 'Hábitos que quiero seguir',
    checkinT: 'Check-in de hoy', saveCheck: 'Guardar check-in', savedCheck: 'Check-in guardado', note: 'Nota del día (opcional)',
    aiT: 'Repaso de Onyx AI', aiBtn: 'Repasar mi disciplina', aiBusy: 'Analizando…',
    lockT: 'Repaso con IA (Pro)', lockD: 'La IA cruza tu plan con tu conducta real y te dice dónde rompes tus reglas. Disponible en Pro.', upgrade: 'Ver planes',
    noPairs: 'Ej: EURUSD, XAUUSD, US30', winR: 'Win rate respetando el límite', winB: 'rompiéndolo', overtr: 'Días de sobre-operar',
  },
  en: { title: 'My plan and habits', sub: 'Your rules, your daily check-in, and how well you follow them.',
    adherence: 'Plan adherence', streak: 'Day streak', checkin: 'Today check-in',
    myPlan: 'My plan', edit: 'Edit', save: 'Save', cancel: 'Cancel', use: 'Use template',
    style: 'Style', risk: 'Risk per trade', ddl: 'Max daily loss', maxt: 'Max trades/day', sessions: 'Sessions', pairs: 'Pairs/markets', goal: 'My goal', rules: 'My rules', addRule: 'Add rule', habitsSel: 'Habits I want to track',
    checkinT: 'Today check-in', saveCheck: 'Save check-in', savedCheck: 'Check-in saved', note: 'Day note (optional)',
    aiT: 'Onyx AI review', aiBtn: 'Review my discipline', aiBusy: 'Analyzing…',
    lockT: 'AI review (Pro)', lockD: 'The AI compares your plan with your real behavior and shows where you break your rules. Available on Pro.', upgrade: 'See plans',
    noPairs: 'e.g. EURUSD, XAUUSD, US30', winR: 'Win rate respecting the limit', winB: 'breaking it', overtr: 'Overtrading days',
  },
};

export default function PlanHabits({ lang }: { lang: Lang }) {
  const t = T[lang]; const i = lang === 'en' ? 1 : 0;
  const [d, setD] = useState<any>(null);
  const [items, setItems] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');
  const [savedCk, setSavedCk] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [review, setReview] = useState('');

  useEffect(() => { load(); }, []);
  async function load() {
    try {
      const r = await fetch('/api/plan'); const j = await r.json();
      setD(j); setItems(j.checkin?.items || {}); setNote(j.checkin?.note || '');
    } catch {}
  }
  if (!d || !d.plan) return <div className="card muted">…</div>;
  const p = d.plan; const s = d.stats || {};

  async function saveCheckin() {
    setBusy('ck');
    const r = await fetch('/api/plan', { method: 'POST', body: JSON.stringify({ items, note }) });
    const j = await r.json(); setBusy('');
    if (j.ok) { setD({ ...d, stats: j.stats }); setSavedCk(true); setTimeout(() => setSavedCk(false), 1500); }
  }
  function startEdit() { setForm(JSON.parse(JSON.stringify(p))); setEditing(true); }
  function applyPreset(style: string) {
    const pr = PRESETS[style]; if (!pr) { setForm({ ...form, style }); return; }
    setForm({ ...form, style, risk_per_trade: pr.risk_per_trade, max_daily_loss_pct: pr.max_daily_loss_pct, max_trades_day: pr.max_trades_day, sessions: [...pr.sessions], habits: [...pr.habits], rules: [...(lang === 'en' ? pr.rules_en : pr.rules_es)] });
  }
  async function savePlan() {
    setBusy('plan');
    const r = await fetch('/api/plan', { method: 'PATCH', body: JSON.stringify({ plan: form }) });
    const j = await r.json(); setBusy('');
    if (j.ok) { setD({ ...d, plan: j.plan, stats: j.stats }); setEditing(false); }
  }
  async function runAI() {
    setBusy('ai'); setReview('');
    const r = await fetch('/api/plan/ai', { method: 'POST', body: JSON.stringify({ lang }) });
    const j = await r.json(); setBusy('');
    if (j.review) setReview(j.review);
  }

  const enabled = p.habits.length || 1;
  const doneToday = p.habits.filter((h: string) => items[h]).length;
  const adColor = s.adherence >= 75 ? 'var(--green)' : s.adherence >= 50 ? 'var(--amber)' : 'var(--red)';

  return (
    <div style={{ maxWidth: 940, margin: '0 auto' }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>🎯 {t.title}</h2>
        <div className="muted" style={{ fontSize: 13 }}>{t.sub}</div>
      </div>

      {/* Métricas */}
      <div className="grid g3" style={{ gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ width: 76, height: 76, borderRadius: '50%', margin: '0 auto 8px', background: `conic-gradient(${adColor} 0 ${s.adherence || 0}%, var(--line) ${s.adherence || 0}% 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>{s.adherence || 0}%</div>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>{t.adherence}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28 }}>🔥</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{s.streak || 0}</div>
          <div className="muted" style={{ fontSize: 12 }}>{t.streak}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{doneToday}/{enabled}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t.checkin}</div>
          <div style={{ height: 5, background: 'var(--bg2)', borderRadius: 5, marginTop: 8, overflow: 'hidden' }}><div style={{ width: (doneToday / enabled) * 100 + '%', height: '100%', background: 'var(--brand)' }} /></div>
        </div>
      </div>

      <div className="grid g2" style={{ gap: 14 }}>
        {/* Mi plan */}
        <div className="card">
          <div className="row between" style={{ marginBottom: 10 }}>
            <b style={{ fontSize: 14 }}>{t.myPlan}</b>
            {!editing && <button className="btn btn-ghost" style={{ fontSize: 12.5, padding: '4px 10px' }} onClick={startEdit}>✎ {t.edit}</button>}
          </div>

          {!editing ? (
            <>
              <PlanRow k={t.style} v={STYLES[p.style]?.[i] || p.style} />
              <PlanRow k={t.risk} v={`${p.risk_per_trade}%`} tag="Guardian" />
              <PlanRow k={t.ddl} v={`-${p.max_daily_loss_pct}%`} tag="Guardian" />
              <PlanRow k={t.maxt} v={p.max_trades_day > 0 ? String(p.max_trades_day) : '—'} tag="Guardian" />
              <PlanRow k={t.sessions} v={p.sessions.map((x: string) => SESS[x]?.[i] || x).join(', ') || '—'} />
              {p.pairs && <PlanRow k={t.pairs} v={p.pairs} />}
              {p.goal && <div style={{ marginTop: 8, fontSize: 13, background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px' }}>🎯 {p.goal}</div>}
              {!!p.rules.length && (
                <div style={{ marginTop: 10 }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t.rules}</div>
                  {p.rules.map((r: string, k: number) => <div key={k} style={{ fontSize: 13, padding: '3px 0', display: 'flex', gap: 7 }}><span style={{ color: 'var(--soft-green)' }}>✓</span>{r}</div>)}
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <span className="muted" style={{ fontSize: 12 }}>{t.style}</span>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {Object.keys(STYLES).map((st) => <button key={st} onClick={() => applyPreset(st)} className={'btn ' + (form.style === st ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 12, padding: '5px 10px' }}>{STYLES[st][i]}</button>)}
                </div>
              </div>
              <div className="grid g3" style={{ gap: 8 }}>
                <div><span className="muted" style={{ fontSize: 12 }}>{t.risk} %</span><input type="number" step="0.1" value={form.risk_per_trade} onChange={(e) => setForm({ ...form, risk_per_trade: Number(e.target.value) })} style={{ margin: '4px 0 0' }} /></div>
                <div><span className="muted" style={{ fontSize: 12 }}>{t.ddl} %</span><input type="number" value={form.max_daily_loss_pct} onChange={(e) => setForm({ ...form, max_daily_loss_pct: Number(e.target.value) })} style={{ margin: '4px 0 0' }} /></div>
                <div><span className="muted" style={{ fontSize: 12 }}>{t.maxt}</span><input type="number" value={form.max_trades_day} onChange={(e) => setForm({ ...form, max_trades_day: Number(e.target.value) })} style={{ margin: '4px 0 0' }} /></div>
              </div>
              <div>
                <span className="muted" style={{ fontSize: 12 }}>{t.sessions}</span>
                <div className="row" style={{ gap: 6, marginTop: 4 }}>
                  {Object.keys(SESS).map((sk) => { const on = form.sessions.includes(sk); return <button key={sk} onClick={() => setForm({ ...form, sessions: on ? form.sessions.filter((x: string) => x !== sk) : [...form.sessions, sk] })} className={'btn ' + (on ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 12, padding: '5px 10px' }}>{SESS[sk][i]}</button>; })}
                </div>
              </div>
              <div><span className="muted" style={{ fontSize: 12 }}>{t.pairs}</span><input value={form.pairs} onChange={(e) => setForm({ ...form, pairs: e.target.value })} placeholder={t.noPairs} style={{ margin: '4px 0 0' }} /></div>
              <div><span className="muted" style={{ fontSize: 12 }}>{t.goal}</span><textarea value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} rows={2} style={{ width: '100%', margin: '4px 0 0' }} /></div>
              <div>
                <span className="muted" style={{ fontSize: 12 }}>{t.rules}</span>
                {form.rules.map((r: string, k: number) => (
                  <div key={k} className="row" style={{ gap: 6, marginTop: 4 }}>
                    <input value={r} onChange={(e) => { const rr = [...form.rules]; rr[k] = e.target.value; setForm({ ...form, rules: rr }); }} style={{ flex: 1, margin: 0, fontSize: 13 }} />
                    <button className="btn btn-ghost" style={{ padding: '4px 9px', color: 'var(--red)' }} onClick={() => setForm({ ...form, rules: form.rules.filter((_: any, j: number) => j !== k) })}>✕</button>
                  </div>
                ))}
                <button className="btn btn-ghost" style={{ fontSize: 12, marginTop: 6 }} onClick={() => setForm({ ...form, rules: [...form.rules, ''] })}>＋ {t.addRule}</button>
              </div>
              <div>
                <span className="muted" style={{ fontSize: 12 }}>{t.habitsSel}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  {Object.keys(HAB).map((hk) => { const on = form.habits.includes(hk); return (
                    <label key={hk} className="row" style={{ gap: 8, fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={on} onChange={() => setForm({ ...form, habits: on ? form.habits.filter((x: string) => x !== hk) : [...form.habits, hk] })} style={{ width: 'auto', margin: 0 }} /> {HAB[hk][i]}</label>
                  ); })}
                </div>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 6 }}>
                <button className="btn btn-primary" onClick={savePlan} disabled={busy === 'plan'}>{busy === 'plan' ? '…' : t.save}</button>
                <button className="btn btn-ghost" onClick={() => setEditing(false)}>{t.cancel}</button>
              </div>
            </div>
          )}
        </div>

        {/* Check-in de hoy */}
        <div className="card">
          <b style={{ fontSize: 14 }}>{t.checkinT}</b>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '10px 0' }}>
            {p.habits.map((hk: string) => (
              <label key={hk} className="row" style={{ gap: 9, fontSize: 13.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!items[hk]} onChange={(e) => setItems({ ...items, [hk]: e.target.checked })} style={{ width: 'auto', margin: 0 }} />
                <span style={{ textDecoration: items[hk] ? 'none' : 'none', opacity: items[hk] ? 1 : .85 }}>{HAB[hk]?.[i] || hk}</span>
              </label>
            ))}
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t.note} style={{ width: '100%', margin: '0 0 8px' }} />
          <button className="btn btn-primary" onClick={saveCheckin} disabled={busy === 'ck'} style={{ width: '100%' }}>{busy === 'ck' ? '…' : savedCk ? '✓ ' + t.savedCheck : t.saveCheck}</button>
        </div>
      </div>

      {/* Repaso IA */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: review ? 10 : 0 }}>
          <b style={{ fontSize: 14 }}>🤖 {d.aiEnabled ? t.aiT : t.lockT}</b>
          {d.aiEnabled
            ? <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={runAI} disabled={busy === 'ai'}>{busy === 'ai' ? t.aiBusy : t.aiBtn}</button>
            : <a className="btn btn-primary" style={{ fontSize: 13 }} href="/pricing">{t.upgrade}</a>}
        </div>
        {!d.aiEnabled && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{t.lockD}</p>}
        {d.aiEnabled && (s.winRateRespect != null || s.overtradingDays > 0) && !review && (
          <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>
            {s.winRateRespect != null && `${t.winR}: ${s.winRateRespect}%`}{s.winRateBroken != null && ` · ${t.winB}: ${s.winRateBroken}%`}{s.overtradingDays > 0 && ` · ${t.overtr}: ${s.overtradingDays}`}
          </p>
        )}
        {review && <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'var(--bg2)', borderRadius: 10, padding: '11px 13px' }}>{review}</div>}
      </div>
    </div>
  );
}

function PlanRow({ k, v, tag }: { k: string; v: string; tag?: string }) {
  return (
    <div className="row between" style={{ padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 13.5 }}>
      <span className="muted">{k}</span>
      <span className="row" style={{ gap: 6, alignItems: 'center' }}><b>{v}</b>{tag && <span className="pill" style={{ fontSize: 10, color: 'var(--soft-brand)', background: 'rgba(124,140,255,.15)' }}>{tag}</span>}</span>
    </div>
  );
}
