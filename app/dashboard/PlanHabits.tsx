'use client';
import { dictFor } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';

type Lang = 'es' | 'en';

// Render del repaso de Onyx AI: cada sección empieza con un emoji + título.
// Nunca muestra símbolos crudos (**, #, -): los limpia y resalta el título.
function ReviewText({ text }: { text: string }) {
  const clean = String(text || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/[*`]/g, '')
    .replace(/^#{1,6}\s*/gm, '').replace(/^\s*[-•]\s+/gm, '');
  const emoji = /^\p{Extended_Pictographic}/u;
  const lines = clean.replace(/\r/g, '').split('\n').map((l) => l.trim());
  const out: any[] = []; let k = 0;
  for (const line of lines) {
    if (!line) continue;
    if (emoji.test(line)) {
      const m = line.match(/^(\S+)\s*(.*)$/);
      out.push(
        <div key={k++} style={{ marginTop: out.length ? 12 : 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', gap: 7, alignItems: 'center' }}>
            <span style={{ fontSize: 16 }}>{m?.[1]}</span><span>{m?.[2]}</span>
          </div>
        </div>
      );
    } else {
      out.push(<div key={k++} style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--mut)', marginTop: 3 }}>{line}</div>);
    }
  }
  return <div>{out}</div>;
}

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
const STYLES: Record<string, [string, string]> = { day: ['Day trader', 'Day trader'], scalper: ['Scalper', 'Scalper'], swing: ['Swing', 'Swing'], funded: ['Fondeo (prop)', 'Funded (prop)'], crypto: ['Cripto', 'Crypto'], algo: ['Algorítmico (bots)', 'Algorithmic (bots)'], custom: ['Personalizado', 'Custom'] };

// Plantillas por tipo de trader (las reglas se rellenan en el idioma actual).
const PRESETS: Record<string, any> = {
  day: { risk_per_trade: 1, max_daily_loss_pct: 3, max_trades_day: 3, sessions: ['london', 'ny'], habits: ['reviewed_calendar', 'defined_risk', 'followed_plan', 'journaled', 'no_revenge'], rules_es: ['Relación riesgo/beneficio mínima 1:2', 'No mover el stop en contra', 'Parar tras 2 pérdidas seguidas'], rules_en: ['Minimum 1:2 risk/reward', 'Never move stop against me', 'Stop after 2 losses in a row'] },
  scalper: { risk_per_trade: 0.5, max_daily_loss_pct: 2, max_trades_day: 8, sessions: ['london', 'ny'], habits: ['defined_risk', 'followed_plan', 'stopped_at_limit', 'no_revenge', 'respected_sessions'], rules_es: ['Solo con spread bajo', 'Salir en 2R o al invalidarse', 'Nada fuera de mi sesión'], rules_en: ['Only on low spread', 'Exit at 2R or on invalidation', 'Nothing outside my session'] },
  swing: { risk_per_trade: 1, max_daily_loss_pct: 5, max_trades_day: 1, sessions: ['asia', 'london', 'ny'], habits: ['defined_risk', 'followed_plan', 'journaled', 'no_revenge'], rules_es: ['Confirmar en H4/D1', 'Máx. 1 operación por par', 'Sin revisar cada vela'], rules_en: ['Confirm on H4/D1', 'Max 1 trade per pair', 'Do not check every candle'] },
  funded: { risk_per_trade: 0.5, max_daily_loss_pct: 4, max_trades_day: 3, sessions: ['london', 'ny'], habits: ['reviewed_calendar', 'defined_risk', 'followed_plan', 'stopped_at_limit', 'no_revenge'], rules_es: ['Respetar el drawdown de la firma', 'No operar en noticias rojas', 'Parar al llegar al objetivo del día'], rules_en: ['Respect the firm drawdown', 'No trading on red news', 'Stop when the daily target is hit'] },
  crypto: { risk_per_trade: 1, max_daily_loss_pct: 5, max_trades_day: 4, sessions: ['asia', 'london', 'ny'], habits: ['defined_risk', 'followed_plan', 'journaled', 'no_revenge'], rules_es: ['Solo BTC/ETH de alta liquidez', 'Apalancamiento máx. 5x', 'Nada de FOMO en velas verdes'], rules_en: ['Only high-liquidity BTC/ETH', 'Max 5x leverage', 'No FOMO on green candles'] },
  algo: { risk_per_trade: 0.5, max_daily_loss_pct: 4, max_trades_day: 0, sessions: ['asia', 'london', 'ny'], habits: ['defined_risk', 'stopped_at_limit', 'no_revenge', 'journaled'], rules_es: ['Revisar cada día que los bots estén activos', 'No intervenir a mano en una operación del bot', 'Frenar un bot si rompe su drawdown máximo', 'Comparar el rendimiento vivo con el backtest'], rules_en: ['Check daily that the bots are running', 'Do not manually override a bot trade', 'Stop a bot if it breaks its max drawdown', 'Compare live performance with the backtest'] },
};

const T: any = {
  es: { title: 'Mi plan y hábitos', sub: 'Tus reglas, tu check-in diario, y qué tan bien las cumples.',
    tabToday: 'Hoy', tabPlan: 'Mi plan', tabLimits: 'Límites y cuentas',
    adherence: 'Adherencia al plan', streak: 'Días de racha', checkin: 'Check-in de hoy',
    histT: 'Cumplimiento · 30 días', monthAdh: 'Adherencia del mes', blockedN: 'Te frenó el Guardian', overrodeN: 'Te lo saltaste', noHist: 'Aún sin historial; se llena cada día.', gOff: 'Enciende el Guardian para medir tu disciplina real.', hmLeg1: 'Cumplido', hmLeg2: 'Flojo', hmLeg3: 'Regla rota',
    momentT: 'Momento del día', mBefore: '☀️ Antes', mDuring: '🕒 Durante', mClose: '🌙 Al cerrar',
    myPlan: 'Mi plan', edit: 'Editar', save: 'Guardar', cancel: 'Cancelar',
    style: 'Estilo', risk: 'Riesgo por operación', ddl: 'Pérdida diaria máx.', maxt: 'Máx. operaciones/día', sessions: 'Sesiones', pairs: 'Pares/mercados', goal: 'Mi objetivo', rules: 'Mis reglas', addRule: 'Añadir regla', habitsSel: 'Hábitos que quiero seguir',
    checkinT: 'Check-in de hoy', checkinTap: 'Toca cada hábito para marcarlo', saveCheck: 'Guardar check-in', savedCheck: 'Check-in guardado', note: 'Nota del día (opcional)',
    aiT: 'Repaso de Onyx AI', aiBtn: 'Repasar mi disciplina', aiBusy: 'Analizando…',
    lockT: 'Repaso con IA (Pro)', lockD: 'La IA cruza tu plan con tu conducta real y te dice dónde rompes tus reglas. Disponible en Pro.', upgrade: 'Ver planes',
    noPairs: 'Ej: EURUSD, XAUUSD, US30', winR: 'Win rate respetando el límite', winB: 'rompiéndolo', overtr: 'Días de sobre-operar',
    gTag: 'Guardian', gOwn: 'objetivo propio',
    gOpen: 'Abrir el Guardian', gNotSet: 'sin configurar',
    gSetup: 'Aún no le has puesto límites al Guardian. Ponlos aquí abajo y se aplican en tus cuentas al instante.',
    limitsT: 'Mis límites', limitsSub: 'los aplica el Onyx Guardian',
    limDL: 'Pérdida diaria máx.', limMT: 'Máx. operaciones/día', limDLh: 'En % de tu cuenta. Si lo pierdes en el día, el Guardian te frena.', limMTh: '0 = sin tope.',
    applyTo: 'Aplicar a:', saveLimits: 'Guardar en el Guardian', saving: 'Guardando…',
    accountsT: 'Tus cuentas', measures: 'La que mide el plan:', main: 'principal',
    scopeT: '¿Qué cuenta mide el plan?', scopePrimary: 'Mi cuenta principal', scopeAll: 'Todas (sin duplicar copias)',
    scopeHint: 'Con copy, una misma decisión se copia a varias cuentas. El plan la cuenta UNA vez para que tu racha sea real.',
    primaryPick: 'Cuenta principal:',
    roleMaster: 'master', roleSlave: 'copia',
    warnSlave: 'recibe copias pero no tiene pérdida diaria máxima.', protect: 'Proteger', configure: 'Configurar',
    lossDay: 'Pérdida/día', maxOps: 'Máx ops', off: 'apagado',
    syncOkT: '¡Listo! Ya está sincronizado', syncOkB: 'Estos números ya se aplican en tus cuentas:', syncClose: 'Entendido',
    syncNoAcc: 'Primero conecta una cuenta para que el Guardian pueda cuidarla.', syncGoConnect: 'Conectar una cuenta',
    syncNoMgr: 'El Onyx Guardian está en los planes Pro y superiores. Mejóralo para que cuide tus cuentas solo.', syncSeePlans: 'Ver planes',
    myHabits: 'Mis hábitos propios', addHabitPh: 'Escribe un hábito tuyo…', add: 'Añadir',
    customHint: 'Lo que añadas aparece en tu check-in de cada día y cuenta para tu racha.', yours: 'mío',
    scOne: 'Solo esta cuenta', scAllA: 'Todas', scType: 'Por tipo',
  },
  en: { title: 'My plan and habits', sub: 'Your rules, your daily check-in, and how well you follow them.',
    tabToday: 'Today', tabPlan: 'My plan', tabLimits: 'Limits & accounts',
    adherence: 'Plan adherence', streak: 'Day streak', checkin: 'Today check-in',
    histT: 'Compliance · 30 days', monthAdh: 'Month adherence', blockedN: 'Guardian stopped you', overrodeN: 'You overrode it', noHist: 'No history yet; it fills daily.', gOff: 'Turn on the Guardian to measure your real discipline.', hmLeg1: 'On track', hmLeg2: 'Weak', hmLeg3: 'Rule broken',
    momentT: 'Time of day', mBefore: '☀️ Before', mDuring: '🕒 During', mClose: '🌙 At close',
    myPlan: 'My plan', edit: 'Edit', save: 'Save', cancel: 'Cancel',
    style: 'Style', risk: 'Risk per trade', ddl: 'Max daily loss', maxt: 'Max trades/day', sessions: 'Sessions', pairs: 'Pairs/markets', goal: 'My goal', rules: 'My rules', addRule: 'Add rule', habitsSel: 'Habits I want to track',
    checkinT: 'Today check-in', checkinTap: 'Tap each habit to mark it', saveCheck: 'Save check-in', savedCheck: 'Check-in saved', note: 'Day note (optional)',
    aiT: 'Onyx AI review', aiBtn: 'Review my discipline', aiBusy: 'Analyzing…',
    lockT: 'AI review (Pro)', lockD: 'The AI compares your plan with your real behavior and shows where you break your rules. Available on Pro.', upgrade: 'See plans',
    noPairs: 'e.g. EURUSD, XAUUSD, US30', winR: 'Win rate respecting the limit', winB: 'breaking it', overtr: 'Overtrading days',
    gTag: 'Guardian', gOwn: 'your target',
    gOpen: 'Open Guardian', gNotSet: 'not set',
    gSetup: 'You haven’t set Guardian limits yet. Set them below and they apply on your accounts instantly.',
    limitsT: 'My limits', limitsSub: 'enforced by Onyx Guardian',
    limDL: 'Max daily loss', limMT: 'Max trades/day', limDLh: 'As % of your account. If you lose it in a day, Guardian stops you.', limMTh: '0 = no cap.',
    applyTo: 'Apply to:', saveLimits: 'Save in Guardian', saving: 'Saving…',
    accountsT: 'Your accounts', measures: 'Plan tracks:', main: 'main',
    scopeT: 'Which account does the plan track?', scopePrimary: 'My main account', scopeAll: 'All (no copy double-count)',
    scopeHint: 'With copy, one decision is mirrored to several accounts. The plan counts it ONCE so your streak is real.',
    primaryPick: 'Main account:',
    roleMaster: 'master', roleSlave: 'copy',
    warnSlave: 'receives copies but has no max daily loss.', protect: 'Protect', configure: 'Configure',
    lossDay: 'Loss/day', maxOps: 'Max trades', off: 'off',
    syncOkT: 'Done! It’s synced', syncOkB: 'These numbers now apply on your accounts:', syncClose: 'Got it',
    syncNoAcc: 'Connect an account first so Guardian can protect it.', syncGoConnect: 'Connect an account',
    syncNoMgr: 'Onyx Guardian is on Pro plans and up. Upgrade so it protects your accounts on its own.', syncSeePlans: 'See plans',
    myHabits: 'My own habits', addHabitPh: 'Type your own habit…', add: 'Add',
    customHint: 'What you add shows in your daily check-in and counts toward your streak.', yours: 'mine',
    scOne: 'Only this account', scAllA: 'All', scType: 'By type',
  },
};

const TYPE_LABEL: Record<string, [string, string]> = { challenge: ['challenge', 'challenge'], funded: ['fondeada', 'funded'], own: ['propia', 'own'], demo: ['demo', 'demo'] };

export default function PlanHabits({ lang, onGoGuardian }: { lang: Lang; onGoGuardian?: () => void }) {
  const t = dictFor(T, lang); const i = lang === 'en' ? 1 : 0;
  const [tab, setTab] = useState<'hoy' | 'plan' | 'limites'>(() => {
    if (typeof window !== 'undefined') { const q = new URLSearchParams(window.location.search).get('tab'); if (q === 'plan' || q === 'limites' || q === 'hoy') return q; }
    return 'hoy';
  });
  const [d, setD] = useState<any>(null);
  const [items, setItems] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');
  const [savedCk, setSavedCk] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [newHabit, setNewHabit] = useState('');
  const [busy, setBusy] = useState('');
  const [review, setReview] = useState('');
  // Editor de límites EN LÍNEA (sin modal): dos números + alcance.
  const [lim, setLim] = useState<any>({ dl: 3, mt: 0, mode: 'all', accountId: '', accType: 'challenge' });
  const [limBusy, setLimBusy] = useState(false);
  const [done, setDone] = useState<any>(null); // { count, accounts } | 'no_acc' | 'no_mgr'

  useEffect(() => { load(); }, []);
  async function load() {
    try {
      const r = await fetch('/api/plan'); const j = await r.json();
      setD(j); setItems(j.checkin?.items || {}); setNote(j.checkin?.note || '');
    } catch {}
  }
  // Al cargar (o tras guardar), sembramos el editor de límites con los números reales.
  useEffect(() => {
    if (!d?.plan) return;
    const gg = d.guardian || {};
    setLim((l: any) => ({
      ...l,
      dl: gg.daily_loss_pct != null ? gg.daily_loss_pct : (d.plan.max_daily_loss_pct || 3),
      mt: gg.max_trades_day != null ? gg.max_trades_day : (d.plan.max_trades_day || 0),
      accountId: l.accountId || gg.accounts?.[0]?.id || '',
      mode: gg.accounts?.length > 1 ? l.mode : 'all',
    }));
  }, [d]);

  function goGuardian() { if (onGoGuardian) onGoGuardian(); else window.location.href = '/dashboard/manager'; }

  if (!d || !d.plan) return <div className="card muted">…</div>;
  const p = d.plan; const s = d.stats || {}; const g = d.guardian || { linked: false, hasAccounts: false, accounts: [] };

  const allHabits: { id: string; label: string; custom: boolean }[] = [
    ...(p.habits || []).map((k: string) => ({ id: k, label: HAB[k]?.[i] || k, custom: false })),
    ...((p.custom_habits || []) as any[]).map((h) => ({ id: h.id, label: h.label, custom: true })),
  ];
  const enabled = allHabits.length || 1;
  const doneToday = allHabits.filter((h) => items[h.id]).length;
  const adColor = s.adherence >= 75 ? 'var(--green)' : s.adherence >= 50 ? 'var(--amber)' : 'var(--red)';
  const primaryName = (g.accounts || []).find((a: any) => a.id === (p.primary_account_id || g.accounts?.[0]?.id))?.name || '—';

  async function saveCheckin() {
    setBusy('ck');
    const r = await fetch('/api/plan', { method: 'POST', body: JSON.stringify({ items, note }) });
    const j = await r.json(); setBusy('');
    if (j.ok) { setD({ ...d, stats: j.stats }); setSavedCk(true); setTimeout(() => setSavedCk(false), 1500); }
  }
  function startEdit() {
    const clone = JSON.parse(JSON.stringify(p));
    if (!Array.isArray(clone.custom_habits)) clone.custom_habits = [];
    setForm(clone); setNewHabit(''); setEditing(true);
  }
  function applyPreset(style: string) {
    const pr = PRESETS[style]; if (!pr) { setForm({ ...form, style }); return; }
    setForm({ ...form, style, risk_per_trade: pr.risk_per_trade, sessions: [...pr.sessions], habits: [...pr.habits], rules: [...(lang === 'en' ? pr.rules_en : pr.rules_es)] });
  }
  function addCustomHabit() {
    const label = newHabit.trim(); if (!label) return;
    setForm({ ...form, custom_habits: [...(form.custom_habits || []), { id: '', label }] });
    setNewHabit('');
  }
  // Momento de cada hábito (antes/durante/al cerrar) — con defaults sensatos.
  const MOMENT_DEF_UI: any = { reviewed_calendar: 'before', defined_risk: 'before', followed_plan: 'before', journaled: 'during', stopped_at_limit: 'during', no_revenge: 'during', respected_sessions: 'during' };
  const momOf = (id: string) => (form?.habit_moments?.[id]) || MOMENT_DEF_UI[id] || 'during';
  const setMom = (id: string, m: string) => setForm({ ...form, habit_moments: { ...(form.habit_moments || {}), [id]: m } });
  const MomentPick = (id: string) => (
    <span style={{ display: 'inline-flex', gap: 3, flex: 'none' }}>
      {([['before', '☀️'], ['during', '🕒'], ['close', '🌙']] as const).map(([m, icon]) => {
        const on = momOf(id) === m;
        return <button key={m} title={m} onClick={(e) => { e.preventDefault(); setMom(id, m); }} style={{ fontSize: 11, padding: '2px 6px', borderRadius: 8, border: '1px solid', borderColor: on ? 'var(--brand)' : 'var(--line)', background: on ? 'rgba(124,140,255,.16)' : 'transparent', color: on ? 'var(--soft-brand)' : 'var(--mut)', cursor: 'pointer' }}>{icon}</button>;
      })}
    </span>
  );
  async function savePlan() {
    setBusy('plan');
    const r = await fetch('/api/plan', { method: 'PATCH', body: JSON.stringify({ plan: { ...form } }) });
    const j = await r.json(); setBusy('');
    if (j.ok) { setD({ ...d, plan: j.plan, stats: j.stats }); setEditing(false); }
  }
  async function runAI() {
    setBusy('ai'); setReview('');
    const r = await fetch('/api/plan/ai', { method: 'POST', body: JSON.stringify({ lang }) });
    const j = await r.json(); setBusy('');
    if (j.review) setReview(j.review);
  }
  async function saveScope(next: { scope?: string; primary_account_id?: string | null }) {
    const payload = { ...p, ...next };
    setD({ ...d, plan: payload });
    const r = await fetch('/api/plan', { method: 'PATCH', body: JSON.stringify({ plan: payload }) });
    const j = await r.json();
    if (j.ok) setD({ ...d, plan: j.plan, stats: j.stats });
  }
  // Guarda los dos límites en el Guardian según el alcance elegido (todo en línea).
  async function saveLimits() {
    if (!g.hasAccounts) { setDone('no_acc'); return; }
    setLimBusy(true);
    try {
      const body: any = { daily_loss_pct: Number(lim.dl), max_trades_day: Number(lim.mt), mode: lim.mode };
      if (lim.mode === 'account') body.account_id = lim.accountId;
      if (lim.mode === 'type') body.acc_type = lim.accType;
      const r = await fetch('/api/plan/guardian', { method: 'POST', body: JSON.stringify(body) });
      if (r.status === 403) { setDone('no_mgr'); return; }
      if (r.status === 400) { setDone('no_acc'); return; }
      const j = await r.json();
      if (j.ok) { setD({ ...d, plan: j.plan, stats: j.stats, guardian: j.guardian }); setDone({ count: j.updated, accounts: (j.guardian?.accounts || []) }); }
    } catch {} finally { setLimBusy(false); }
  }
  // Preselecciona el editor de límites para UNA cuenta (desde avisos o la lista).
  function editAccount(a: any) {
    setLim({
      dl: a.daily_loss_pct != null ? a.daily_loss_pct : (p.max_daily_loss_pct || 3),
      mt: a.max_trades_day != null ? a.max_trades_day : (p.max_trades_day || 0),
      mode: 'account', accountId: a.id, accType: a.acc_type || 'challenge',
    });
    setTab('limites');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
  const modal: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, maxWidth: 460, width: '100%', padding: 20, maxHeight: '90vh', overflowY: 'auto' };
  const stepBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 9, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx)', fontSize: 18, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' };
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const tabBtn = (id: typeof tab, label: string, icon: string) => (
    <button onClick={() => setTab(id)} style={{ flex: 1, padding: '9px 6px', borderRadius: 10, border: tab === id ? 'none' : '1px solid var(--line)', background: tab === id ? 'var(--grad)' : 'transparent', color: tab === id ? '#fff' : 'var(--tx)', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{icon} {label}</button>
  );
  const accColor = (a: any) => a.daily_loss_pct != null ? 'var(--green)' : (a.max_trades_day != null ? 'var(--amber)' : 'var(--red)');

  return (
    <div style={{ maxWidth: 940, margin: '0 auto' }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon emoji="🎯" size={22} /></span> {t.title}</h2>
          <div className="muted" style={{ fontSize: 13 }}>{t.sub}</div>
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={goGuardian}>🛡️ {t.gOpen} →</button>
      </div>

      {/* Pestañas: cada una hace UN trabajo */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {tabBtn('hoy', t.tabToday, '☀️')}
        {tabBtn('plan', t.tabPlan, '📋')}
        {tabBtn('limites', t.tabLimits, '🛡️')}
      </div>

      {/* ================= HOY ================= */}
      {tab === 'hoy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ width: 84, height: 84, borderRadius: '50%', background: `conic-gradient(${adColor} 0 ${s.adherence || 0}%, var(--line) ${s.adherence || 0}% 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--card)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><b style={{ fontSize: 18 }}>{s.adherence || 0}%</b><span className="muted" style={{ fontSize: 9 }}>{t.adherence}</span></div>
            </div>
            <div style={{ flex: 1, minWidth: 170 }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                <div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><OnyxIcon emoji="🔥" size={18} /> {s.streak || 0}</div><div className="muted" style={{ fontSize: 11 }}>{t.streak}</div></div>
                <div><div style={{ fontSize: 20, fontWeight: 800 }}>{doneToday}/{enabled}</div><div className="muted" style={{ fontSize: 11 }}>{t.checkin}</div></div>
              </div>
              <div style={{ height: 8, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden' }}><div style={{ width: (doneToday / enabled) * 100 + '%', height: '100%', background: 'var(--brand)', transition: 'width .2s' }} /></div>
            </div>
          </div>

          {/* Cumplimiento · 30 días (foto diaria + Guardian real) */}
          {(() => {
            const hist: any[] = (d as any).history || [];
            const monthAdh = hist.length ? Math.round(hist.reduce((a, b) => a + (b.adherence || 0), 0) / hist.length) : (s.adherence || 0);
            const cellColor = (r: any) => (r.blocked > 0 || r.overrode > 0) ? '#e24b4a' : (r.adherence >= 70 ? '#1d9e75' : r.adherence >= 45 ? '#ef9f27' : '#c0492b');
            const cell = (r: any) => `${r.day}: ${r.adherence}%${(r.blocked || r.overrode) ? ' · ' + t.hmLeg3 : ''}`;
            return (
              <div className="card">
                <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  <b style={{ fontSize: 14 }}>🗓️ {t.histT}</b>
                  <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}><div style={{ fontSize: 16, fontWeight: 800, color: adColor }}>{monthAdh}%</div><div className="muted" style={{ fontSize: 10 }}>{t.monthAdh}</div></div>
                    <div style={{ textAlign: 'right' }}><div style={{ fontSize: 16, fontWeight: 800, color: 'var(--red)' }}>{s.blocks || 0}</div><div className="muted" style={{ fontSize: 10 }}>{t.blockedN}</div></div>
                    <div style={{ textAlign: 'right' }}><div style={{ fontSize: 16, fontWeight: 800, color: 'var(--amber)' }}>{s.overrides || 0}</div><div className="muted" style={{ fontSize: 10 }}>{t.overrodeN}</div></div>
                  </div>
                </div>
                {hist.length ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(15,1fr)', gap: 5, maxWidth: 430 }}>
                      {hist.slice(-30).map((r) => <div key={r.day} title={cell(r)} style={{ aspectRatio: '1', borderRadius: 4, background: cellColor(r), opacity: 0.92 }} />)}
                    </div>
                    <div className="row" style={{ gap: 14, marginTop: 10, fontSize: 11, flexWrap: 'wrap' }}>
                      <span className="row" style={{ gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#1d9e75' }} /> {t.hmLeg1}</span>
                      <span className="row" style={{ gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#ef9f27' }} /> {t.hmLeg2}</span>
                      <span className="row" style={{ gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#e24b4a' }} /> {t.hmLeg3}</span>
                    </div>
                  </>
                ) : <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>{t.noHist}</p>}
                {s.guardianActive === false && <p className="muted" style={{ fontSize: 11.5, margin: '10px 0 0' }}>🛡️ {t.gOff}</p>}
              </div>
            );
          })()}

          <div className="card">
            <b style={{ fontSize: 14 }}>{t.checkinT}</b>
            <div className="muted" style={{ fontSize: 11.5, margin: '2px 0 10px' }}>{t.checkinTap}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {allHabits.map((h) => {
                const on = !!items[h.id];
                return (
                  <button key={h.id} onClick={() => setItems({ ...items, [h.id]: !on })} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, border: '1px solid', borderColor: on ? 'var(--green)' : 'var(--line)', background: on ? 'color-mix(in srgb,var(--green) 14%,transparent)' : 'var(--bg2)', color: on ? 'var(--green)' : 'var(--tx)' }}>
                    <span>{on ? '✓' : '○'}</span>{h.label}
                    {h.custom && <span className="pill" style={{ fontSize: 9, color: 'var(--soft-brand)', background: 'rgba(124,140,255,.15)' }}>{t.yours}</span>}
                  </button>
                );
              })}
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t.note} style={{ width: '100%', margin: '12px 0 8px' }} />
            <button className="btn btn-primary" onClick={saveCheckin} disabled={busy === 'ck'} style={{ width: '100%' }}>{busy === 'ck' ? '…' : savedCk ? '✓ ' + t.savedCheck : t.saveCheck}</button>
          </div>

          <div className="card">
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
            {review && <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', marginTop: 8 }}><ReviewText text={review} /></div>}
          </div>
        </div>
      )}

      {/* ================= MI PLAN ================= */}
      {tab === 'plan' && (
        <div className="card">
          <div className="row between" style={{ marginBottom: 10 }}>
            <b style={{ fontSize: 14 }}>{t.myPlan}</b>
            {!editing && <button className="btn btn-ghost" style={{ fontSize: 12.5, padding: '4px 10px' }} onClick={startEdit}>✎ {t.edit}</button>}
          </div>

          {!editing ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 11 }}><div className="muted" style={{ fontSize: 11 }}>{t.style}</div><b style={{ fontSize: 14 }}>{STYLES[p.style]?.[i] || p.style}</b></div>
                <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 11 }}><div className="muted" style={{ fontSize: 11 }}>{t.risk} · {t.gOwn}</div><b style={{ fontSize: 14 }}>{p.risk_per_trade}%</b></div>
                <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 11 }}><div className="muted" style={{ fontSize: 11 }}>{t.sessions}</div><b style={{ fontSize: 13 }}>{p.sessions.map((x: string) => SESS[x]?.[i] || x).join(' · ') || '—'}</b></div>
                {p.pairs && <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 11 }}><div className="muted" style={{ fontSize: 11 }}>{t.pairs}</div><b style={{ fontSize: 13 }}>{p.pairs}</b></div>}
                {p.goal && <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 11 }}><div className="muted" style={{ fontSize: 11 }}>🎯 {t.goal}</div><b style={{ fontSize: 13 }}>{p.goal}</b></div>}
              </div>
              {!!p.rules.length && (
                <div style={{ marginTop: 12 }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t.rules}</div>
                  {p.rules.map((r: string, k: number) => <div key={k} style={{ fontSize: 13, padding: '3px 0', display: 'flex', gap: 7 }}><span style={{ color: 'var(--soft-green)' }}>✓</span>{r}</div>)}
                </div>
              )}
              <div style={{ marginTop: 12, fontSize: 12, background: 'var(--bg2)', borderRadius: 10, padding: '9px 11px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>🛡️</span>
                <span className="muted" style={{ flex: 1 }}>{lang === 'en' ? 'Your daily loss and max trades live in the “Limits & accounts” tab.' : 'Tu pérdida diaria y máx. de operaciones viven en la pestaña “Límites y cuentas”.'}</span>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 9px' }} onClick={() => setTab('limites')}>{t.tabLimits} →</button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <span className="muted" style={{ fontSize: 12 }}>{t.style}</span>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {Object.keys(STYLES).map((st) => <button key={st} onClick={() => applyPreset(st)} className={'btn ' + (form.style === st ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 12, padding: '5px 10px' }}>{STYLES[st][i]}</button>)}
                </div>
              </div>
              <div>
                <span className="muted" style={{ fontSize: 12 }}>{t.risk} % <span style={{ opacity: .7 }}>· {t.gOwn}</span></span>
                <input type="number" step="0.1" value={form.risk_per_trade} onChange={(e) => setForm({ ...form, risk_per_trade: Number(e.target.value) })} style={{ margin: '4px 0 0' }} />
              </div>
              <div style={{ fontSize: 12, background: 'var(--bg2)', borderRadius: 10, padding: '9px 11px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>🛡️</span>
                <span className="muted" style={{ flex: 1 }}>{lang === 'en' ? 'Daily loss and max trades live in “Limits & accounts”.' : 'La pérdida diaria y el máx. de operaciones viven en “Límites y cuentas”.'}</span>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 9px' }} onClick={() => { setEditing(false); setTab('limites'); }}>{t.tabLimits} →</button>
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
                <span className="muted" style={{ fontSize: 12 }}>{t.habitsSel} <span style={{ opacity: .7 }}>· {t.momentT}</span></span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  {Object.keys(HAB).map((hk) => { const on = form.habits.includes(hk); return (
                    <div key={hk} className="row between" style={{ gap: 8 }}>
                      <label className="row" style={{ gap: 8, fontSize: 13, cursor: 'pointer', flex: 1 }}><input type="checkbox" checked={on} onChange={() => setForm({ ...form, habits: on ? form.habits.filter((x: string) => x !== hk) : [...form.habits, hk] })} style={{ width: 'auto', margin: 0 }} /> {HAB[hk][i]}</label>
                      {on && MomentPick(hk)}
                    </div>
                  ); })}
                </div>
              </div>
              <div>
                <span className="muted" style={{ fontSize: 12 }}>{t.myHabits}</span>
                {(form.custom_habits || []).map((h: any, k: number) => (
                  <div key={k} className="row" style={{ gap: 6, marginTop: 4 }}>
                    <span style={{ color: 'var(--brand)' }}>✚</span>
                    <input value={h.label} onChange={(e) => { const cc = [...form.custom_habits]; cc[k] = { ...cc[k], label: e.target.value }; setForm({ ...form, custom_habits: cc }); }} style={{ flex: 1, margin: 0, fontSize: 13 }} />
                    {h.id ? MomentPick(h.id) : null}
                    <button className="btn btn-ghost" style={{ padding: '4px 9px', color: 'var(--red)' }} onClick={() => setForm({ ...form, custom_habits: form.custom_habits.filter((_: any, j: number) => j !== k) })}>✕</button>
                  </div>
                ))}
                <div className="row" style={{ gap: 6, marginTop: 6 }}>
                  <input value={newHabit} onChange={(e) => setNewHabit(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomHabit(); } }} placeholder={t.addHabitPh} style={{ flex: 1, margin: 0, fontSize: 13 }} />
                  <button className="btn btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={addCustomHabit}>＋ {t.add}</button>
                </div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 5 }}>{t.customHint}</div>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 6 }}>
                <button className="btn btn-primary" onClick={savePlan} disabled={busy === 'plan'}>{busy === 'plan' ? '…' : t.save}</button>
                <button className="btn btn-ghost" onClick={() => setEditing(false)}>{t.cancel}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= LÍMITES Y CUENTAS ================= */}
      {tab === 'limites' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Avisos accionables arriba */}
          {(g.warnings || []).map((w: any) => (
            <div key={w.account_id} style={{ fontSize: 12.5, background: 'rgba(255,192,77,.10)', border: '1px solid var(--amber)', borderRadius: 12, padding: '10px 13px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>⚠️</span>
              <span style={{ flex: 1, minWidth: 140 }}><b>{w.name}</b> {t.warnSlave}</span>
              <button className="btn btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => { const a = g.accounts.find((x: any) => x.id === w.account_id); if (a) editAccount(a); }}>🛡️ {t.protect}</button>
            </div>
          ))}

          {/* Editor de límites EN LÍNEA */}
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 700 }}>{t.limitsT} <span className="muted" style={{ fontSize: 11, fontWeight: 600 }}>· {t.limitsSub}</span></div>
            {!g.hasAccounts ? (
              <div style={{ marginTop: 10 }}>
                <p className="muted" style={{ fontSize: 13 }}>{t.gSetup}</p>
                <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setDone('no_acc')}>{t.syncGoConnect}</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginTop: 12 }}>
                  <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '13px', textAlign: 'center' }}>
                    <div className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>🐷 {t.limDL}</div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <button style={stepBtn} onClick={() => setLim({ ...lim, dl: Math.max(0, r1(Number(lim.dl) - 0.5)) })}>−</button>
                      <b style={{ fontSize: 24, minWidth: 62 }}>{lim.dl}%</b>
                      <button style={stepBtn} onClick={() => setLim({ ...lim, dl: r1(Number(lim.dl) + 0.5) })}>+</button>
                    </div>
                    <div className="muted" style={{ fontSize: 10.5, marginTop: 6 }}>{t.limDLh}</div>
                  </div>
                  <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '13px', textAlign: 'center' }}>
                    <div className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>🎚️ {t.limMT}</div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <button style={stepBtn} onClick={() => setLim({ ...lim, mt: Math.max(0, Number(lim.mt) - 1) })}>−</button>
                      <b style={{ fontSize: 24, minWidth: 40 }}>{Number(lim.mt) === 0 ? t.off : lim.mt}</b>
                      <button style={stepBtn} onClick={() => setLim({ ...lim, mt: Number(lim.mt) + 1 })}>+</button>
                    </div>
                    <div className="muted" style={{ fontSize: 10.5, marginTop: 6 }}>{t.limMTh}</div>
                  </div>
                </div>

                {/* Alcance de guardado */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
                  <span className="muted" style={{ fontSize: 12 }}>{t.applyTo}</span>
                  {g.accounts.length > 1 && (
                    <button className={'btn ' + (lim.mode === 'account' ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 12, padding: '5px 11px' }} onClick={() => setLim({ ...lim, mode: 'account' })}>{t.scOne}</button>
                  )}
                  {lim.mode === 'account' && g.accounts.length > 1 && (
                    <select value={lim.accountId} onChange={(e) => setLim({ ...lim, accountId: e.target.value })} style={{ margin: 0, width: 'auto', minWidth: 150, fontSize: 12.5 }}>
                      {g.accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  )}
                  <button className={'btn ' + (lim.mode === 'all' ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 12, padding: '5px 11px' }} onClick={() => setLim({ ...lim, mode: 'all' })}>{t.scAllA}</button>
                  {g.accounts.length > 1 && (
                    <button className={'btn ' + (lim.mode === 'type' ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 12, padding: '5px 11px' }} onClick={() => setLim({ ...lim, mode: 'type' })}>{t.scType}</button>
                  )}
                  {lim.mode === 'type' && (
                    <select value={lim.accType} onChange={(e) => setLim({ ...lim, accType: e.target.value })} style={{ margin: 0, width: 'auto', fontSize: 12.5 }}>
                      {['challenge', 'funded', 'own', 'demo'].map((tp) => <option key={tp} value={tp}>{TYPE_LABEL[tp][i]}</option>)}
                    </select>
                  )}
                  <button className="btn btn-primary" style={{ marginLeft: 'auto', fontSize: 12.5 }} onClick={saveLimits} disabled={limBusy}>{limBusy ? t.saving : '🛡️ ' + t.saveLimits}</button>
                </div>
              </>
            )}
          </div>

          {/* Tus cuentas con semáforo */}
          {g.hasAccounts && g.accounts.length > 0 && (
            <div className="card">
              <b style={{ fontSize: 14 }}>{t.accountsT}</b>
              <div className="muted" style={{ fontSize: 11.5, margin: '2px 0 11px' }}>{t.measures} <b style={{ color: 'var(--tx)' }}>{primaryName}</b> ({t.main})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {g.accounts.map((a: any) => (
                  <div key={a.id} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 11, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: accColor(a), flex: 'none' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                        <b style={{ fontSize: 13.5 }}>{a.name}</b>
                        {a.acc_type && TYPE_LABEL[a.acc_type] && <span className="pill" style={{ fontSize: 9, background: 'rgba(255,192,77,.15)', color: 'var(--amber)' }}>{TYPE_LABEL[a.acc_type][i]}</span>}
                        {a.copy_role === 'master' && <span className="pill" style={{ fontSize: 9, background: 'rgba(124,140,255,.15)', color: 'var(--soft-brand)' }}>📡 {t.roleMaster}</span>}
                        {a.copy_role === 'slave' && <span className="pill" style={{ fontSize: 9, background: 'rgba(52,226,160,.15)', color: 'var(--soft-green)' }}>📄 {t.roleSlave}</span>}
                      </div>
                      <div style={{ fontSize: 11, marginTop: 2, color: a.daily_loss_pct == null ? 'var(--red)' : 'var(--mut)' }}>
                        {t.lossDay}: {a.daily_loss_pct != null ? `-${a.daily_loss_pct}%` : t.gNotSet} · {t.maxOps}: {a.max_trades_day != null ? a.max_trades_day : '—'}
                      </div>
                    </div>
                    <button className="btn btn-primary" style={{ fontSize: 11.5, padding: '6px 11px' }} onClick={() => editAccount(a)}>{a.daily_loss_pct == null ? t.protect : t.configure}</button>
                  </div>
                ))}
              </div>

              {/* Alcance: qué cuenta MIDE el plan */}
              <div style={{ marginTop: 14 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 5 }}>{t.scopeT}</div>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <button className={'btn ' + (p.scope !== 'all' ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => saveScope({ scope: 'primary' })}>🎯 {t.scopePrimary}</button>
                  <button className={'btn ' + (p.scope === 'all' ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => saveScope({ scope: 'all' })}>🗂️ {t.scopeAll}</button>
                </div>
                {p.scope !== 'all' && g.accounts.length > 1 && (
                  <div className="row" style={{ gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="muted" style={{ fontSize: 12 }}>{t.primaryPick}</span>
                    <select value={p.primary_account_id || (g.accounts.find((a: any) => a.copy_role === 'master')?.id || g.accounts[0]?.id || '')} onChange={(e) => saveScope({ primary_account_id: e.target.value })} style={{ margin: 0, width: 'auto', minWidth: 160, fontSize: 12.5 }}>
                      {g.accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}{a.copy_role === 'master' ? ' (master)' : ''}</option>)}
                    </select>
                  </div>
                )}
                <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{t.scopeHint}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Confirmación / avisos (feedback, no edición) ===== */}
      {done && (
        <div style={overlay} onClick={() => setDone(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            {done === 'no_acc' ? (
              <>
                <div style={{ fontSize: 17, fontWeight: 800 }}>🔌 {lang === 'en' ? 'One step first' : 'Un paso antes'}</div>
                <p className="muted" style={{ fontSize: 13.5, margin: '8px 0 14px' }}>{t.syncNoAcc}</p>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setDone(null)}>{t.cancel}</button>
                  <button className="btn btn-primary" style={{ flex: 2 }} onClick={goGuardian}>{t.syncGoConnect}</button>
                </div>
              </>
            ) : done === 'no_mgr' ? (
              <>
                <div style={{ fontSize: 17, fontWeight: 800 }}>🛡️ Onyx Guardian</div>
                <p className="muted" style={{ fontSize: 13.5, margin: '8px 0 14px' }}>{t.syncNoMgr}</p>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setDone(null)}>{t.cancel}</button>
                  <a className="btn btn-primary" style={{ flex: 2, textAlign: 'center' }} href="/pricing">{t.syncSeePlans}</a>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>✅ {t.syncOkT}</div>
                <p className="muted" style={{ fontSize: 13.5, margin: '8px 0 12px' }}>{t.syncOkB}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {(done.accounts || []).map((a: any) => (
                    <div key={a.id} className="row between" style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 11px', fontSize: 13 }}>
                      <span>🛡️ {a.name}</span>
                      <span style={{ fontWeight: 700 }}>-{a.daily_loss_pct ?? '—'}% · {a.max_trades_day != null ? a.max_trades_day : t.off}</span>
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setDone(null)}>{t.syncClose}</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
