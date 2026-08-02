'use client';
import { useEffect, useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';

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
    adherence: 'Adherencia al plan', streak: 'Días de racha', checkin: 'Check-in de hoy',
    myPlan: 'Mi plan', edit: 'Editar', save: 'Guardar', cancel: 'Cancelar',
    style: 'Estilo', risk: 'Riesgo por operación', ddl: 'Pérdida diaria máx.', maxt: 'Máx. operaciones/día', sessions: 'Sesiones', pairs: 'Pares/mercados', goal: 'Mi objetivo', rules: 'Mis reglas', addRule: 'Añadir regla', habitsSel: 'Hábitos que quiero seguir',
    checkinT: 'Check-in de hoy', saveCheck: 'Guardar check-in', savedCheck: 'Check-in guardado', note: 'Nota del día (opcional)',
    aiT: 'Repaso de Onyx AI', aiBtn: 'Repasar mi disciplina', aiBusy: 'Analizando…',
    lockT: 'Repaso con IA (Pro)', lockD: 'La IA cruza tu plan con tu conducta real y te dice dónde rompes tus reglas. Disponible en Pro.', upgrade: 'Ver planes',
    noPairs: 'Ej: EURUSD, XAUUSD, US30', winR: 'Win rate respetando el límite', winB: 'rompiéndolo', overtr: 'Días de sobre-operar',
    // Guardian
    gTag: 'Guardian', gOwn: 'objetivo propio',
    gBox: 'La pérdida diaria y el máximo de operaciones los vigila el Onyx Guardian en tu cuenta. Aquí ves el número REAL que se está aplicando.',
    gOpen: 'Abrir el Guardian', gAdjust: 'Ajustar estos límites', gNotSet: 'sin configurar',
    gSetup: 'Aún no le has puesto límites al Guardian. Ponlos una vez y aquí aparecerán solos.',
    // Popup sync
    syncTitle: 'Ajustar mis límites', syncSub: 'Pon dos números. Los guardamos en el Guardian y se aplican en TODAS tus cuentas al instante.',
    syncDL: '¿Cuánto es lo máximo que aceptas perder en un día?', syncDLh: 'En % de tu cuenta. Ejemplo: 3 = si pierdes el 3% en el día, el Guardian te frena.',
    syncMT: '¿Cuántas operaciones como máximo al día?', syncMTh: 'Escribe 0 si no quieres tope. Ejemplo: 3 = a la 4ª el Guardian no te deja abrir.',
    syncApply: 'Guardar en el Guardian', syncApplying: 'Guardando…', syncCancel: 'Cancelar',
    syncOkT: '¡Listo! Ya está sincronizado', syncOkB: 'Estos números ya se aplican en tus cuentas:', syncClose: 'Entendido',
    syncNoAcc: 'Primero conecta una cuenta para que el Guardian pueda cuidarla.', syncGoConnect: 'Conectar una cuenta',
    syncNoMgr: 'El Onyx Guardian está en los planes Pro y superiores. Mejóralo para que cuide tus cuentas solo.', syncSeePlans: 'Ver planes',
    accsUpd: 'cuenta(s) actualizada(s)', off: 'apagado',
    // Custom habits
    myHabits: 'Mis hábitos propios', addHabitPh: 'Escribe un hábito tuyo…', add: 'Añadir',
    customHint: 'Lo que añadas aparece en tu check-in de cada día y cuenta para tu racha.',
    yours: 'mío',
    // Multicuenta / copy / alcance
    accountsT: 'Tus cuentas y sus límites', scopeT: '¿Qué cuenta mide el plan?',
    scopePrimary: 'Mi cuenta principal', scopeAll: 'Todas (sin duplicar copias)',
    scopeHint: 'Con copy, una misma decisión se copia a varias cuentas. El plan la cuenta UNA vez para que tu racha sea real.',
    primaryPick: 'Cuenta principal:',
    roleMaster: 'master', roleSlave: 'copia',
    typeChallenge: 'challenge', typeFunded: 'fondeada', typeOwn: 'propia', typeDemo: 'demo',
    warnSlave: 'recibe copias pero no tiene pérdida diaria máxima.', protect: 'Proteger',
    colAcc: 'Cuenta', colLoss: 'Pérdida/día', colMax: 'Máx ops',
    syncScopeT: '¿A qué cuentas lo aplico?', scOne: 'Solo a esta cuenta', scAllA: 'A todas mis cuentas', scType: 'Solo a las de tipo',
  },
  en: { title: 'My plan and habits', sub: 'Your rules, your daily check-in, and how well you follow them.',
    adherence: 'Plan adherence', streak: 'Day streak', checkin: 'Today check-in',
    myPlan: 'My plan', edit: 'Edit', save: 'Save', cancel: 'Cancel',
    style: 'Style', risk: 'Risk per trade', ddl: 'Max daily loss', maxt: 'Max trades/day', sessions: 'Sessions', pairs: 'Pairs/markets', goal: 'My goal', rules: 'My rules', addRule: 'Add rule', habitsSel: 'Habits I want to track',
    checkinT: 'Today check-in', saveCheck: 'Save check-in', savedCheck: 'Check-in saved', note: 'Day note (optional)',
    aiT: 'Onyx AI review', aiBtn: 'Review my discipline', aiBusy: 'Analyzing…',
    lockT: 'AI review (Pro)', lockD: 'The AI compares your plan with your real behavior and shows where you break your rules. Available on Pro.', upgrade: 'See plans',
    noPairs: 'e.g. EURUSD, XAUUSD, US30', winR: 'Win rate respecting the limit', winB: 'breaking it', overtr: 'Overtrading days',
    gTag: 'Guardian', gOwn: 'your target',
    gBox: 'Your daily loss and max trades are watched by Onyx Guardian on your account. Here you see the REAL number being enforced.',
    gOpen: 'Open Guardian', gAdjust: 'Adjust these limits', gNotSet: 'not set',
    gSetup: 'You haven’t set Guardian limits yet. Set them once and they’ll show up here automatically.',
    syncTitle: 'Adjust my limits', syncSub: 'Enter two numbers. We save them in Guardian and apply them to ALL your accounts instantly.',
    syncDL: 'What’s the most you’re willing to lose in one day?', syncDLh: 'As % of your account. Example: 3 = if you lose 3% in a day, Guardian stops you.',
    syncMT: 'How many trades per day, at most?', syncMTh: 'Type 0 for no cap. Example: 3 = on the 4th, Guardian won’t let you open.',
    syncApply: 'Save in Guardian', syncApplying: 'Saving…', syncCancel: 'Cancel',
    syncOkT: 'Done! It’s synced', syncOkB: 'These numbers now apply on your accounts:', syncClose: 'Got it',
    syncNoAcc: 'Connect an account first so Guardian can protect it.', syncGoConnect: 'Connect an account',
    syncNoMgr: 'Onyx Guardian is on Pro plans and up. Upgrade so it protects your accounts on its own.', syncSeePlans: 'See plans',
    accsUpd: 'account(s) updated', off: 'off',
    myHabits: 'My own habits', addHabitPh: 'Type your own habit…', add: 'Add',
    customHint: 'What you add shows in your daily check-in and counts toward your streak.',
    yours: 'mine',
    accountsT: 'Your accounts and their limits', scopeT: 'Which account does the plan track?',
    scopePrimary: 'My main account', scopeAll: 'All (no copy double-count)',
    scopeHint: 'With copy, one decision is mirrored to several accounts. The plan counts it ONCE so your streak is real.',
    primaryPick: 'Main account:',
    roleMaster: 'master', roleSlave: 'copy',
    typeChallenge: 'challenge', typeFunded: 'funded', typeOwn: 'own', typeDemo: 'demo',
    warnSlave: 'receives copies but has no max daily loss.', protect: 'Protect',
    colAcc: 'Account', colLoss: 'Loss/day', colMax: 'Max trades',
    syncScopeT: 'Apply to which accounts?', scOne: 'Only this account', scAllA: 'All my accounts', scType: 'Only accounts of type',
  },
};

const TYPE_LABEL: Record<string, [string, string]> = { challenge: ['challenge', 'challenge'], funded: ['fondeada', 'funded'], own: ['propia', 'own'], demo: ['demo', 'demo'] };

export default function PlanHabits({ lang, onGoGuardian }: { lang: Lang; onGoGuardian?: () => void }) {
  const t = T[lang] || T.en; const i = lang === 'en' ? 1 : 0;
  const [d, setD] = useState<any>(null);
  const [items, setItems] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');
  const [savedCk, setSavedCk] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [newHabit, setNewHabit] = useState('');
  const [busy, setBusy] = useState('');
  const [review, setReview] = useState('');
  // Popup de sincronización con el Guardian
  const [sync, setSync] = useState<any>(null); // { dl, mt } abierto | null
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncDone, setSyncDone] = useState<any>(null); // { count, accounts } | 'no_acc' | 'no_mgr'

  useEffect(() => { load(); }, []);
  async function load() {
    try {
      const r = await fetch('/api/plan'); const j = await r.json();
      setD(j); setItems(j.checkin?.items || {}); setNote(j.checkin?.note || '');
    } catch {}
  }
  function goGuardian() { if (onGoGuardian) onGoGuardian(); else window.location.href = '/dashboard/manager'; }

  if (!d || !d.plan) return <div className="card muted">…</div>;
  const p = d.plan; const s = d.stats || {}; const g = d.guardian || { linked: false, hasAccounts: false, accounts: [] };

  // Lista unificada de hábitos para el check-in: predefinidos elegidos + propios.
  const allHabits: { id: string; label: string; custom: boolean }[] = [
    ...(p.habits || []).map((k: string) => ({ id: k, label: HAB[k]?.[i] || k, custom: false })),
    ...((p.custom_habits || []) as any[]).map((h) => ({ id: h.id, label: h.label, custom: true })),
  ];
  const enabled = allHabits.length || 1;
  const doneToday = allHabits.filter((h) => items[h.id]).length;
  const adColor = s.adherence >= 75 ? 'var(--green)' : s.adherence >= 50 ? 'var(--amber)' : 'var(--red)';

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
  async function savePlan() {
    setBusy('plan');
    // No mandamos los dos campos del Guardian desde aquí: son suyos.
    const payload = { ...form };
    const r = await fetch('/api/plan', { method: 'PATCH', body: JSON.stringify({ plan: payload }) });
    const j = await r.json(); setBusy('');
    if (j.ok) { setD({ ...d, plan: j.plan, stats: j.stats }); setEditing(false); }
  }
  async function runAI() {
    setBusy('ai'); setReview('');
    const r = await fetch('/api/plan/ai', { method: 'POST', body: JSON.stringify({ lang }) });
    const j = await r.json(); setBusy('');
    if (j.review) setReview(j.review);
  }
  // ---- Guardar el alcance del plan (qué cuenta mide) ----
  async function saveScope(next: { scope?: string; primary_account_id?: string | null }) {
    const payload = { ...p, ...next };
    setD({ ...d, plan: payload }); // optimista
    const r = await fetch('/api/plan', { method: 'PATCH', body: JSON.stringify({ plan: payload }) });
    const j = await r.json();
    if (j.ok) setD({ ...d, plan: j.plan, stats: j.stats });
  }
  // ---- Sincronización con el Guardian ----
  // target opcional: { accountId } para proteger/ajustar una cuenta concreta.
  function openSync(target?: { accountId?: string }) {
    if (!g.hasAccounts) { setSyncDone('no_acc'); return; }
    setSyncDone(null);
    const acc = target?.accountId ? g.accounts.find((a: any) => a.id === target.accountId) : null;
    setSync({
      dl: acc?.daily_loss_pct != null ? acc.daily_loss_pct : (g.daily_loss_pct != null ? g.daily_loss_pct : (p.max_daily_loss_pct || 3)),
      mt: acc?.max_trades_day != null ? acc.max_trades_day : (g.max_trades_day != null ? g.max_trades_day : (p.max_trades_day || 0)),
      mode: target?.accountId ? 'account' : (g.accounts.length > 1 ? 'account' : 'all'),
      accountId: target?.accountId || (g.accounts[0]?.id || ''),
      accType: 'challenge',
    });
  }
  async function applySync() {
    setSyncBusy(true);
    try {
      const body: any = { daily_loss_pct: Number(sync.dl), max_trades_day: Number(sync.mt), mode: sync.mode };
      if (sync.mode === 'account') body.account_id = sync.accountId;
      if (sync.mode === 'type') body.acc_type = sync.accType;
      const r = await fetch('/api/plan/guardian', { method: 'POST', body: JSON.stringify(body) });
      if (r.status === 403) { setSync(null); setSyncDone('no_mgr'); return; }
      if (r.status === 400) { setSync(null); setSyncDone('no_acc'); return; }
      const j = await r.json();
      if (j.ok) {
        setD({ ...d, plan: j.plan, stats: j.stats, guardian: j.guardian });
        setSync(null);
        setSyncDone({ count: j.updated, accounts: (j.guardian?.accounts || []) });
      }
    } catch {} finally { setSyncBusy(false); }
  }

  const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
  const modal: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, maxWidth: 460, width: '100%', padding: 20, maxHeight: '90vh', overflowY: 'auto' };
  const bigInput: React.CSSProperties = { width: '100%', fontSize: 22, fontWeight: 700, textAlign: 'center', padding: '10px 0', margin: '6px 0 0' };

  return (
    <div style={{ maxWidth: 940, margin: '0 auto' }}>
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon emoji="🎯" size={22} /></span> {t.title}</h2>
          <div className="muted" style={{ fontSize: 13 }}>{t.sub}</div>
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={goGuardian}>🛡️ {t.gOpen} →</button>
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
          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--amber)' }}><OnyxIcon emoji="🔥" size={28} /></div>
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
              <PlanRow k={t.risk} v={`${p.risk_per_trade}%`} tag={t.gOwn} tagKind="own" />
              <PlanRow k={t.ddl} v={g.daily_loss_pct != null ? `-${g.daily_loss_pct}%` : t.gNotSet} tag={t.gTag} tagKind={g.daily_loss_pct != null ? 'guardian' : 'off'} />
              <PlanRow k={t.maxt} v={g.max_trades_day != null ? String(g.max_trades_day) : (g.linked ? t.off : t.gNotSet)} tag={t.gTag} tagKind={g.max_trades_day != null ? 'guardian' : 'off'} />
              <PlanRow k={t.sessions} v={p.sessions.map((x: string) => SESS[x]?.[i] || x).join(', ') || '—'} />
              {p.pairs && <PlanRow k={t.pairs} v={p.pairs} />}

              {/* Caja explicativa iluminada + botones de acción hacia el Guardian */}
              <style>{`@keyframes onyxGlow{0%,100%{box-shadow:0 0 0 1px rgba(124,140,255,.55),0 0 14px rgba(124,140,255,.28)}50%{box-shadow:0 0 0 1px rgba(124,140,255,.8),0 0 26px rgba(124,140,255,.55)}}`}</style>
              <div style={{ marginTop: 12, fontSize: 12.5, background: 'rgba(124,140,255,.08)', border: '1px solid var(--brand)', borderRadius: 10, padding: '11px 13px', display: 'flex', gap: 9, alignItems: 'center', animation: 'onyxGlow 2.6s ease-in-out infinite' }}>
                <span style={{ flex: 'none', fontSize: 17 }}>🛡️</span>
                <span style={{ color: 'var(--soft-brand2, var(--soft-brand))' }}>{g.hasAccounts ? t.gBox : t.gSetup}</span>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" style={{ fontSize: 12.5 }} onClick={() => openSync()}>⚙️ {t.gAdjust}</button>
                <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={goGuardian}>🛡️ {t.gOpen}</button>
              </div>

              {/* Avisos: esclavas sin límite */}
              {(g.warnings || []).map((w: any) => (
                <div key={w.account_id} style={{ marginTop: 10, fontSize: 12.5, background: 'rgba(255,192,77,.10)', border: '1px solid var(--amber)', borderRadius: 10, padding: '9px 11px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>⚠️</span>
                  <span style={{ flex: 1, minWidth: 140 }}><b>{w.name}</b> {t.warnSlave}</span>
                  <button className="btn btn-primary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => openSync({ accountId: w.account_id })}>🛡️ {t.protect}</button>
                </div>
              ))}

              {/* Panel por cuenta (si hay más de una, o hay copy) */}
              {g.hasAccounts && g.accounts.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 5 }}>{t.accountsT}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr .8fr .7fr', gap: 6, fontSize: 10.5, color: 'var(--mut)', padding: '0 8px' }}>
                    <span>{t.colAcc}</span><span>{t.colLoss}</span><span>{t.colMax}</span>
                  </div>
                  {g.accounts.map((a: any) => (
                    <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr .8fr .7fr', gap: 6, alignItems: 'center', background: 'var(--bg2)', borderRadius: 8, padding: '7px 8px', marginTop: 4, fontSize: 12.5 }}>
                      <span style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                        {a.name}
                        {a.acc_type && TYPE_LABEL[a.acc_type] && <span className="pill" style={{ fontSize: 9, background: 'rgba(255,192,77,.15)', color: 'var(--amber)' }}>{TYPE_LABEL[a.acc_type][i]}</span>}
                        {a.copy_role === 'master' && <span className="pill" style={{ fontSize: 9, background: 'rgba(124,140,255,.15)', color: 'var(--soft-brand)' }}>📡 {t.roleMaster}</span>}
                        {a.copy_role === 'slave' && <span className="pill" style={{ fontSize: 9, background: 'rgba(52,226,160,.15)', color: 'var(--soft-green)' }}>📄 {t.roleSlave}</span>}
                      </span>
                      <span style={{ fontWeight: 700, color: a.daily_loss_pct == null ? 'var(--red)' : undefined }}>{a.daily_loss_pct != null ? `-${a.daily_loss_pct}%` : t.gNotSet}</span>
                      <span style={{ fontWeight: 700 }}>{a.max_trades_day != null ? a.max_trades_day : '—'}</span>
                    </div>
                  ))}

                  {/* Alcance: qué mide el plan */}
                  <div style={{ marginTop: 12 }}>
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

              {p.goal && <div style={{ marginTop: 12, fontSize: 13, background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px' }}>🎯 {p.goal}</div>}
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
              <div>
                <span className="muted" style={{ fontSize: 12 }}>{t.risk} % <span style={{ opacity: .7 }}>· {t.gOwn}</span></span>
                <input type="number" step="0.1" value={form.risk_per_trade} onChange={(e) => setForm({ ...form, risk_per_trade: Number(e.target.value) })} style={{ margin: '4px 0 0' }} />
              </div>
              {/* Pérdida diaria y máx ops NO se editan aquí: son del Guardian */}
              <div style={{ fontSize: 12, background: 'var(--bg2)', borderRadius: 10, padding: '9px 11px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>🛡️</span>
                <span className="muted" style={{ flex: 1 }}>{lang === 'en' ? 'Daily loss and max trades live in Guardian.' : 'La pérdida diaria y el máx. de operaciones viven en el Guardian.'}</span>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 9px' }} onClick={() => { setEditing(false); openSync(); }}>⚙️ {t.gAdjust}</button>
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
              {/* Hábitos propios */}
              <div>
                <span className="muted" style={{ fontSize: 12 }}>{t.myHabits}</span>
                {(form.custom_habits || []).map((h: any, k: number) => (
                  <div key={k} className="row" style={{ gap: 6, marginTop: 4 }}>
                    <span style={{ color: 'var(--brand)' }}>✚</span>
                    <input value={h.label} onChange={(e) => { const cc = [...form.custom_habits]; cc[k] = { ...cc[k], label: e.target.value }; setForm({ ...form, custom_habits: cc }); }} style={{ flex: 1, margin: 0, fontSize: 13 }} />
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

        {/* Check-in de hoy */}
        <div className="card">
          <b style={{ fontSize: 14 }}>{t.checkinT}</b>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '10px 0' }}>
            {allHabits.map((h) => (
              <label key={h.id} className="row" style={{ gap: 9, fontSize: 13.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!items[h.id]} onChange={(e) => setItems({ ...items, [h.id]: e.target.checked })} style={{ width: 'auto', margin: 0 }} />
                <span style={{ opacity: items[h.id] ? 1 : .85 }}>{h.label}</span>
                {h.custom && <span className="pill" style={{ fontSize: 9.5, marginLeft: 'auto', color: 'var(--soft-brand)', background: 'rgba(124,140,255,.15)' }}>{t.yours}</span>}
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

      {/* ===== Popup: ajustar límites (sincroniza con el Guardian) ===== */}
      {sync && (
        <div style={overlay} onClick={() => !syncBusy && setSync(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>🛡️ {t.syncTitle}</div>
            <p className="muted" style={{ fontSize: 13, margin: '6px 0 14px' }}>{t.syncSub}</p>

            <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>💸 {t.syncDL}</div>
              <div style={{ position: 'relative' }}>
                <input type="number" step="0.5" value={sync.dl} onChange={(e) => setSync({ ...sync, dl: e.target.value })} style={bigInput} />
                <span style={{ position: 'absolute', right: 14, top: 16, fontSize: 18, fontWeight: 700, color: 'var(--mut)' }}>%</span>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t.syncDLh}</div>
            </div>

            <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>🔢 {t.syncMT}</div>
              <input type="number" step="1" value={sync.mt} onChange={(e) => setSync({ ...sync, mt: e.target.value })} style={bigInput} />
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t.syncMTh}</div>
            </div>

            {/* Alcance: a qué cuentas se aplica (solo si hay más de una) */}
            {g.accounts.length > 1 && (
              <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>🎯 {t.syncScopeT}</div>
                <label className="row" style={{ gap: 8, fontSize: 13, cursor: 'pointer', padding: '3px 0' }}>
                  <input type="radio" checked={sync.mode === 'account'} onChange={() => setSync({ ...sync, mode: 'account' })} style={{ width: 'auto', margin: 0 }} />
                  <span>{t.scOne}</span>
                  {sync.mode === 'account' && (
                    <select value={sync.accountId} onChange={(e) => setSync({ ...sync, accountId: e.target.value })} style={{ margin: 0, width: 'auto', minWidth: 130, fontSize: 12.5, marginLeft: 'auto' }}>
                      {g.accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  )}
                </label>
                <label className="row" style={{ gap: 8, fontSize: 13, cursor: 'pointer', padding: '3px 0' }}>
                  <input type="radio" checked={sync.mode === 'all'} onChange={() => setSync({ ...sync, mode: 'all' })} style={{ width: 'auto', margin: 0 }} />
                  <span>{t.scAllA}</span>
                </label>
                <label className="row" style={{ gap: 8, fontSize: 13, cursor: 'pointer', padding: '3px 0' }}>
                  <input type="radio" checked={sync.mode === 'type'} onChange={() => setSync({ ...sync, mode: 'type' })} style={{ width: 'auto', margin: 0 }} />
                  <span>{t.scType}</span>
                  {sync.mode === 'type' && (
                    <select value={sync.accType} onChange={(e) => setSync({ ...sync, accType: e.target.value })} style={{ margin: 0, width: 'auto', fontSize: 12.5, marginLeft: 'auto' }}>
                      {['challenge', 'funded', 'own', 'demo'].map((tp) => <option key={tp} value={tp}>{TYPE_LABEL[tp][i]}</option>)}
                    </select>
                  )}
                </label>
              </div>
            )}

            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSync(null)} disabled={syncBusy}>{t.syncCancel}</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={applySync} disabled={syncBusy}>{syncBusy ? t.syncApplying : '🛡️ ' + t.syncApply}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Popup de resultado ===== */}
      {syncDone && (
        <div style={overlay} onClick={() => setSyncDone(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            {syncDone === 'no_acc' ? (
              <>
                <div style={{ fontSize: 17, fontWeight: 800 }}>🔌 {lang === 'en' ? 'One step first' : 'Un paso antes'}</div>
                <p className="muted" style={{ fontSize: 13.5, margin: '8px 0 14px' }}>{t.syncNoAcc}</p>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSyncDone(null)}>{t.syncCancel}</button>
                  <button className="btn btn-primary" style={{ flex: 2 }} onClick={goGuardian}>{t.syncGoConnect}</button>
                </div>
              </>
            ) : syncDone === 'no_mgr' ? (
              <>
                <div style={{ fontSize: 17, fontWeight: 800 }}>🛡️ Onyx Guardian</div>
                <p className="muted" style={{ fontSize: 13.5, margin: '8px 0 14px' }}>{t.syncNoMgr}</p>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSyncDone(null)}>{t.syncCancel}</button>
                  <a className="btn btn-primary" style={{ flex: 2, textAlign: 'center' }} href="/pricing">{t.syncSeePlans}</a>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>✅ {t.syncOkT}</div>
                <p className="muted" style={{ fontSize: 13.5, margin: '8px 0 12px' }}>{t.syncOkB}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {(syncDone.accounts || []).map((a: any) => (
                    <div key={a.id} className="row between" style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 11px', fontSize: 13 }}>
                      <span>🛡️ {a.name}</span>
                      <span style={{ fontWeight: 700 }}>-{a.daily_loss_pct ?? '—'}% · {a.max_trades_day != null ? a.max_trades_day : t.off}</span>
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setSyncDone(null)}>{t.syncClose}</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanRow({ k, v, tag, tagKind }: { k: string; v: string; tag?: string; tagKind?: 'guardian' | 'own' | 'off' }) {
  const styleFor = tagKind === 'guardian'
    ? { color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' }
    : tagKind === 'off'
      ? { color: 'var(--mut)', background: 'var(--bg2)' }
      : { color: 'var(--soft-brand)', background: 'rgba(124,140,255,.15)' };
  return (
    <div className="row between" style={{ padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 13.5 }}>
      <span className="muted">{k}</span>
      <span className="row" style={{ gap: 6, alignItems: 'center' }}><b>{v}</b>{tag && <span className="pill" style={{ fontSize: 10, ...styleFor }}>{tagKind === 'guardian' ? '🔒 ' : ''}{tag}</span>}</span>
    </div>
  );
}
