'use client';
import { useEffect, useState } from 'react';
import { Ring } from './Modern';

type Lang = 'es' | 'en';
const money = (n: number) => (n >= 0 ? '+$' : '-$') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
const MO = { es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };

const T = {
  es: { title: '🏆 Logros y metas', streak: 'Racha de días verdes', bestMonth: 'Mejor mes', bestDay: 'Mejor día', trophies: 'Trofeos', challengesPassed: 'challenges aprobados', funded: 'cuentas fondeadas', badges: 'Insignias', goal: 'Meta mensual de profit', goalPh: 'Ej: 2000', goalSet: 'Fijar', progress: 'Progreso este mes', noGoal: 'Fija una meta para ver tu progreso.', days: 'días' },
  en: { title: '🏆 Achievements & goals', streak: 'Green-day streak', bestMonth: 'Best month', bestDay: 'Best day', trophies: 'Trophies', challengesPassed: 'challenges passed', funded: 'funded accounts', badges: 'Badges', goal: 'Monthly profit goal', goalPh: 'e.g. 2000', goalSet: 'Set', progress: 'This month progress', noGoal: 'Set a goal to track your progress.', days: 'days' },
};

export default function Achievements({ a, accounts, lang }: { a: any; accounts: any[]; lang: Lang }) {
  const t = T[lang];
  const [goal, setGoal] = useState<number>(0);
  const [edit, setEdit] = useState('');
  useEffect(() => { try { const g = Number(localStorage.getItem('onyx_goal') || 0); setGoal(g); setEdit(g ? String(g) : ''); } catch {} }, []);
  function saveGoal() { const g = Number(edit) || 0; setGoal(g); try { localStorage.setItem('onyx_goal', String(g)); } catch {} }

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

  // mes actual
  const nd = new Date(); const curKey = `${nd.getUTCFullYear()}-${String(nd.getUTCMonth() + 1).padStart(2, '0')}`;
  const monthNet = a.byMonth[curKey]?.net || 0;
  const prog = goal > 0 ? Math.max(0, Math.min(1, monthNet / goal)) : 0;

  const passed = accounts.filter((x) => x.acc_type === 'challenge' && x.challenge_status === 'passed').length;
  const funded = accounts.filter((x) => x.acc_type === 'funded').length;

  const badges: string[] = [];
  if (a.winRate >= 60) badges.push('🎯 ' + (lang === 'es' ? 'Francotirador' : 'Sniper'));
  if (a.profitFactor >= 2) badges.push('⚖️ PF 2+');
  if (a.n >= 50) badges.push('💪 50+ ops');
  if (a.n >= 100) badges.push('🚀 100+ ops');
  if (streak >= 3) badges.push('🔥 ' + streak + ' ' + t.days);
  if (a.maxWin >= 5) badges.push('🏆 ' + a.maxWin + 'W');
  if (monthNet > 0) badges.push('🟢 ' + (lang === 'es' ? 'Mes verde' : 'Green month'));

  const box = { background: 'var(--bg2)', borderRadius: 12, padding: 14 } as any;

  return (
    <div className="card">
      <h3 style={{ marginBottom: 14 }}>{t.title}</h3>
      <div className="grid g3" style={{ marginBottom: 14 }}>
        <div style={{ ...box, borderLeft: '3px solid #ff8a3d' }}><div className="muted" style={{ fontSize: 12 }}>{t.streak}</div><div style={{ fontSize: 24, fontWeight: 800 }}>🔥 {streak} <span style={{ fontSize: 14, fontWeight: 500 }} className="muted">{t.days}</span></div></div>
        <div style={{ ...box, borderLeft: '3px solid #34e2a0' }}><div className="muted" style={{ fontSize: 12 }}>{t.bestMonth}</div><div style={{ fontSize: 18, fontWeight: 800 }}>{bmLabel}</div><div className="pos" style={{ fontSize: 13 }}>{bestMonthNet > -Infinity ? money(bestMonthNet) : ''}</div></div>
        <div style={{ ...box, borderLeft: '3px solid #7c8cff' }}><div className="muted" style={{ fontSize: 12 }}>{t.bestDay}</div><div style={{ fontSize: 18, fontWeight: 800 }}>{bestDayKey || '—'}</div><div className="pos" style={{ fontSize: 13 }}>{bestDayNet > -Infinity ? money(bestDayNet) : ''}</div></div>
      </div>

      {(passed > 0 || funded > 0) && <div style={{ marginBottom: 14, fontSize: 14 }}><span className="muted">{t.trophies}: </span>{passed > 0 && <b>🏅 {passed} {t.challengesPassed}</b>}{passed > 0 && funded > 0 && ' · '}{funded > 0 && <b>💰 {funded} {t.funded}</b>}</div>}

      {badges.length > 0 && (<div style={{ marginBottom: 16 }}><div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{t.badges}</div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{badges.map((b, i) => <span key={i} style={{ padding: '5px 11px', borderRadius: 20, background: 'var(--card2)', fontSize: 13, fontWeight: 600 }}>{b}</span>)}</div></div>)}

      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}><Ring size={84} pct={prog} color={prog >= 1 ? '#34e2a0' : '#7c8cff'} value={goal > 0 ? Math.round(prog * 100) + '%' : '—'} /></div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{t.goal}</div>
          {goal > 0 && <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{t.progress}: <b className={monthNet >= 0 ? 'pos' : 'neg'}>{money(monthNet)}</b> / ${goal.toLocaleString()}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" placeholder={t.goalPh} value={edit} onChange={(e) => setEdit(e.target.value)} style={{ margin: 0, maxWidth: 160 }} />
            <button className="btn btn-primary" onClick={saveGoal}>{t.goalSet}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
