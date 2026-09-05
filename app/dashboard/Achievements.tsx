'use client';
import { dictFor } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';
import { Ring } from './Modern';

type Lang = 'es' | 'en';
const money = (n: number) => (n >= 0 ? '+$' : '-$') + Math.abs(Math.round(n)).toLocaleString('en-US', { maximumFractionDigits: 0 });
const MO = { es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };

// Inicio de la semana ISO (lunes 00:00) en la hora LOCAL del navegador → así los
// cortes de día/semana caen a la medianoche del trader, no en UTC.
function weekStart(dt: Date): number {
  const x = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const day = (x.getDay() + 6) % 7;   // 0 = lunes
  x.setDate(x.getDate() - day);
  return x.getTime();
}

const T = {
  es: {
    title: 'Logros y metas', streak: 'Racha de días verdes', bestMonth: 'Mejor mes', bestDay: 'Mejor día',
    trophies: 'Trofeos', challengesPassed: 'challenges aprobados', funded: 'cuentas fondeadas', badges: 'Insignias',
    goalsHead: 'Mis metas de ganancia', goalsSub: 'Cuánto quieres ganar por semana, mes y año, sumando todas tus cuentas.',
    goalW: 'Meta semanal', goalM: 'Meta mensual', goalY: 'Meta anual', pW: 'Esta semana', pM: 'Este mes', pY: 'Este año',
    remain: 'Te faltan', done: '¡Meta cumplida!', over: 'sobre la meta', setGoals: 'Fijar metas', save: 'Guardar metas', saved: 'Guardado ✓', saveErr: 'No se pudo guardar. Inténtalo de nuevo.',
    tzNote: 'Se guardan en tu cuenta · con tu zona horaria', days: 'días', wk: 'Semanal', mo: 'Mensual', yr: 'Anual',
  },
  en: {
    title: 'Achievements & goals', streak: 'Green-day streak', bestMonth: 'Best month', bestDay: 'Best day',
    trophies: 'Trophies', challengesPassed: 'challenges passed', funded: 'funded accounts', badges: 'Badges',
    goalsHead: 'My profit goals', goalsSub: 'How much you want to make per week, month and year, across all your accounts.',
    goalW: 'Weekly goal', goalM: 'Monthly goal', goalY: 'Annual goal', pW: 'This week', pM: 'This month', pY: 'This year',
    remain: 'to go', done: 'Goal reached', over: 'over goal', setGoals: 'Set goals', save: 'Save goals', saved: 'Saved ✓', saveErr: "Couldn't save. Try again.",
    tzNote: 'Saved to your account · in your timezone', days: 'days', wk: 'Weekly', mo: 'Monthly', yr: 'Annual',
  },
};

export default function Achievements({ a, accounts, trades = [], lang }: { a: any; accounts: any[]; trades?: any[]; lang: Lang }) {
  const t = dictFor(T, lang);

  // Metas (semanal/mensual/anual). Persisten en el servidor; localStorage es solo
  // una caché para pintar al instante mientras llega la respuesta.
  const [gw, setGw] = useState(0); const [gm, setGm] = useState(0); const [gy, setGy] = useState(0);
  const [ew, setEw] = useState(''); const [em, setEm] = useState(''); const [ey, setEy] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveErr, setSaveErr] = useState(false);

  useEffect(() => {
    try {
      const w = Number(localStorage.getItem('onyx_goal_w') || 0);
      const m = Number(localStorage.getItem('onyx_goal') || localStorage.getItem('onyx_goal_m') || 0);
      const y = Number(localStorage.getItem('onyx_goal_y') || 0);
      setGw(w); setGm(m); setGy(y); setEw(w ? String(w) : ''); setEm(m ? String(m) : ''); setEy(y ? String(y) : '');
    } catch {}
    (async () => {
      try {
        const r = await fetch('/api/goals'); if (!r.ok) return; const j = await r.json();
        setGw(j.week || 0); setGm(j.month || 0); setGy(j.year || 0);
        setEw(j.week ? String(j.week) : ''); setEm(j.month ? String(j.month) : ''); setEy(j.year ? String(j.year) : '');
      } catch {}
    })();
  }, []);

  async function saveGoals() {
    const w = Number(ew) || 0, m = Number(em) || 0, y = Number(ey) || 0;
    setGw(w); setGm(m); setGy(y); setSaveErr(false);
    try { localStorage.setItem('onyx_goal_w', String(w)); localStorage.setItem('onyx_goal', String(m)); localStorage.setItem('onyx_goal_m', String(m)); localStorage.setItem('onyx_goal_y', String(y)); } catch {}
    try {
      const r = await fetch('/api/goals', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ week: w, month: m, year: y }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) { setSaveErr(true); return; }
      // Confiamos en lo que el servidor confirma que guardó (fuente de verdad).
      const sw = Number(j.week ?? w), sm = Number(j.month ?? m), sy = Number(j.year ?? y);
      setGw(sw); setGm(sm); setGy(sy);
      setEw(sw ? String(sw) : ''); setEm(sm ? String(sm) : ''); setEy(sy ? String(sy) : '');
      setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1600);
    } catch { setSaveErr(true); }
  }

  // Progreso de cada período calculado desde las operaciones en la ZONA LOCAL del
  // trader (se cierra la op en su día/semana/mes según su reloj, no en UTC).
  const now = new Date(); const wkStart = weekStart(now); const yr = now.getFullYear(); const mo = now.getMonth();
  let wNet = 0, mNet = 0, yNet = 0;
  for (const x of (trades || [])) {
    const d = new Date(x.close_time); const p = +x.net_profit || 0;
    if (d.getFullYear() === yr) { yNet += p; if (d.getMonth() === mo) mNet += p; }
    if (weekStart(d) === wkStart) wNet += p;
  }

  // racha de días verdes (desde el día operado más reciente hacia atrás)
  const dayKeys = Object.keys(a.daily).sort().reverse();
  let streak = 0;
  for (const k of dayKeys) { if (a.daily[k].net >= 0) streak++; else break; }

  // mejor mes / mejor día
  let bestMonthKey = '', bestMonthNet = -Infinity;
  for (const k in a.byMonth) if (a.byMonth[k].net > bestMonthNet) { bestMonthNet = a.byMonth[k].net; bestMonthKey = k; }
  let bestDayNet = -Infinity, bestDayKey = '';
  for (const k in a.daily) if (a.daily[k].net > bestDayNet) { bestDayNet = a.daily[k].net; bestDayKey = k; }
  const bmLabel = bestMonthKey ? `${MO[lang][+bestMonthKey.split('-')[1] - 1]} ${bestMonthKey.split('-')[0].slice(2)}` : '—';

  const passed = accounts.filter((x) => x.acc_type === 'challenge' && x.challenge_status === 'passed').length;
  const funded = accounts.filter((x) => x.acc_type === 'funded').length;

  // Insignias con iconos de línea (no emojis).
  const badges: { icon: string; label: string; color: string }[] = [];
  if (a.winRate >= 60) badges.push({ icon: 'plan', label: lang === 'es' ? 'Francotirador' : 'Sniper', color: 'var(--brand)' });
  if (a.profitFactor >= 2) badges.push({ icon: 'scale', label: 'PF 2+', color: 'var(--brand)' });
  if (a.n >= 100) badges.push({ icon: 'optim', label: '100+ ops', color: 'var(--brand)' });
  else if (a.n >= 50) badges.push({ icon: 'bars', label: '50+ ops', color: 'var(--brand)' });
  if (streak >= 3) badges.push({ icon: 'streak', label: streak + ' ' + t.days, color: 'var(--amber)' });
  if (a.maxWin >= 5) badges.push({ icon: 'trophy', label: a.maxWin + 'W', color: 'var(--gold)' });
  if (mNet > 0) badges.push({ icon: 'up', label: lang === 'es' ? 'Mes verde' : 'Green month', color: 'var(--green)' });

  const box = { background: 'var(--bg2)', borderRadius: 12, padding: 14 } as any;

  const goalCards = [
    { icon: 'calendar', label: t.goalW, period: t.pW, cur: wNet, target: gw },
    { icon: 'calendar', label: t.goalM, period: t.pM, cur: mNet, target: gm },
    { icon: 'trophy', label: t.goalY, period: t.pY, cur: yNet, target: gy },
  ];

  return (
    <div className="card">
      <h3 style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ display: 'inline-flex', color: 'var(--gold)' }}><OnyxIcon name="trophy" size={20} /></span>{t.title}</h3>

      <div className="grid g3" style={{ marginBottom: 14 }}>
        <div style={{ ...box, borderLeft: '3px solid #ff8a3d' }}><div className="muted" style={{ fontSize: 12 }}>{t.streak}</div><div style={{ fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ display: 'inline-flex', color: 'var(--amber)' }}><OnyxIcon name="streak" size={22} /></span> {streak} <span style={{ fontSize: 14, fontWeight: 500 }} className="muted">{t.days}</span></div></div>
        <div style={{ ...box, borderLeft: '3px solid var(--green)' }}><div className="muted" style={{ fontSize: 12 }}>{t.bestMonth}</div><div style={{ fontSize: 18, fontWeight: 800 }}>{bmLabel}</div><div className="pos" style={{ fontSize: 13 }}>{bestMonthNet > -Infinity ? money(bestMonthNet) : ''}</div></div>
        <div style={{ ...box, borderLeft: '3px solid var(--brand)' }}><div className="muted" style={{ fontSize: 12 }}>{t.bestDay}</div><div style={{ fontSize: 18, fontWeight: 800 }}>{bestDayKey || '—'}</div><div className="pos" style={{ fontSize: 13 }}>{bestDayNet > -Infinity ? money(bestDayNet) : ''}</div></div>
      </div>

      {(passed > 0 || funded > 0) && <div style={{ marginBottom: 14, fontSize: 14 }}><span className="muted">{t.trophies}: </span>{passed > 0 && <b><span style={{ display: 'inline-flex', verticalAlign: '-3px', color: 'var(--gold)' }}><OnyxIcon name="trophy" size={16} /></span> {passed} {t.challengesPassed}</b>}{passed > 0 && funded > 0 && ' · '}{funded > 0 && <b><span style={{ display: 'inline-flex', verticalAlign: '-3px', color: 'var(--green)' }}><OnyxIcon name="money" size={16} /></span> {funded} {t.funded}</b>}</div>}

      {badges.length > 0 && (<div style={{ marginBottom: 16 }}><div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{t.badges}</div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{badges.map((b, i) => <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 20, background: 'var(--card2)', fontSize: 13, fontWeight: 600 }}><span style={{ display: 'inline-flex', color: b.color }}><OnyxIcon name={b.icon} size={15} /></span>{b.label}</span>)}</div></div>)}

      {/* Metas: semanal / mensual / anual, con progreso y lo que falta */}
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>{t.goalsHead}</div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>{t.goalsSub}</div>
        <div className="grid g3" style={{ gap: 12 }}>
          {goalCards.map((g, i) => {
            const prog = g.target > 0 ? Math.max(0, Math.min(1, g.cur / g.target)) : 0;
            const remain = g.target - g.cur;
            const reached = g.target > 0 && g.cur >= g.target;
            return (
              <div key={i} style={{ ...box, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Ring size={72} pct={prog} color={reached ? 'var(--green)' : 'var(--brand)'} value={g.target > 0 ? Math.round(prog * 100) + '%' : '—'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ display: 'inline-flex', color: 'var(--brand)' }}><OnyxIcon name={g.icon} size={15} /></span>{g.label}</div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{g.period}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}><span className={g.cur >= 0 ? 'pos' : 'neg'}>{money(g.cur)}</span> <span className="muted">/ ${(g.target || 0).toLocaleString()}</span></div>
                  {g.target > 0 && (
                    <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, padding: '3px 9px', borderRadius: 16, background: reached ? 'rgba(35,197,120,.15)' : 'var(--card2)', color: reached ? 'var(--green)' : 'var(--tx)' }}>
                      <span style={{ display: 'inline-flex' }}><OnyxIcon name={reached ? 'check' : 'flag'} size={12} /></span>
                      {reached ? t.done : (lang === 'es' ? `${t.remain} ${money(remain).replace('+', '')}` : `${money(remain).replace('+', '')} ${t.remain}`)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Fijar metas */}
        <div style={{ marginTop: 14 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{t.setGoals} · <span style={{ opacity: .8 }}>{t.tzNote}</span></div>
          <div className="grid g3" style={{ gap: 10 }}>
            <label style={{ fontSize: 12 }} className="muted">{t.wk}<input type="number" placeholder="500" value={ew} onChange={(e) => setEw(e.target.value)} style={{ margin: '5px 0 0', width: '100%' }} /></label>
            <label style={{ fontSize: 12 }} className="muted">{t.mo}<input type="number" placeholder="2000" value={em} onChange={(e) => setEm(e.target.value)} style={{ margin: '5px 0 0', width: '100%' }} /></label>
            <label style={{ fontSize: 12 }} className="muted">{t.yr}<input type="number" placeholder="24000" value={ey} onChange={(e) => setEy(e.target.value)} style={{ margin: '5px 0 0', width: '100%' }} /></label>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={saveGoals}>{savedFlash ? t.saved : t.save}</button>
            {saveErr && <span style={{ fontSize: 12.5, color: 'var(--red, #ff6b6b)' }}>{(t as any).saveErr}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
