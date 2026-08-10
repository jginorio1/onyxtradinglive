'use client';
import { dictFor } from '@/lib/i18n';
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/lang';
import Link from 'next/link';
import { analyze, bestOf, worstOf, topPairs, fmtDur, type T, type Bucket } from '@/lib/analytics';
import Journal from './Journal';
import LotCalculator from './LotCalculator';
import Challenge from './Challenge';
import Costs from './Costs';
import AccountExtras from './AccountExtras';
import CompareAccounts from './CompareAccounts';
import { typeMeta } from '@/lib/accountMeta';
import { Ring, MiniArea, MiniDonut, MiniBars, MiniHeat, RadarChart, Bubbles, healthScore } from './Modern';
import MarketHours from './MarketHours';
import ReferralBanner from './ReferralBanner';
import PlanHabits from './PlanHabits';
import DailyCheckinPopup from './DailyCheckinPopup';
import HubVitals, { StatCard, type Vital, type Tile } from './HubVitals';
import SetupGuide from './SetupGuide';
import OnyxIcon from '@/app/components/OnyxIcon';
import News from './News';
import NetRealCard from './NetRealCard';
import CoachCard from './CoachCard';
import Achievements from './Achievements';
import Nudge from './Nudge';
import { platformLabel, platformsPhrase } from '@/lib/platforms';
import { useCatalog } from '@/lib/useCatalog';

// Genera operaciones de ejemplo variadas (modo demo)
function genDemo(accId: string): TT[] {
  const syms = ['US100', 'EURUSD', 'GBPUSD', 'XAUUSD', 'GER40'];
  const out: TT[] = []; let t = Date.now() - 90 * 864e5;
  for (let i = 0; i < 165; i++) {
    t += Math.random() * 11 * 3600 * 1000;
    const sym = syms[Math.floor(Math.random() * syms.length)];
    const side = Math.random() < 0.5 ? 'buy' : 'sell';
    const vol = Math.round((0.1 + Math.random() * 1.9) * 100) / 100;
    const win = Math.random() < 0.58;
    const big = sym === 'US100' || sym === 'GER40' || sym === 'XAUUSD';
    const mag = (big ? 60 + Math.random() * 320 : 20 + Math.random() * 180);
    const gross = win ? mag : -mag * (0.65 + Math.random() * 0.6);
    const comm = -vol * 3.2;
    const swap = Math.random() < 0.28 ? -(Math.random() * 4) : (Math.random() < 0.1 ? Math.random() * 2 : 0);
    const openT = new Date(t); openT.setUTCHours(6 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60));
    const closeT = new Date(openT.getTime() + (5 + Math.random() * 240) * 60000);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    out.push({ id: 'demo' + i, account_id: accId, symbol: sym, side, volume: vol, open_time: openT.toISOString(), close_time: closeT.toISOString(), profit: r2(gross), commission: r2(comm), swap: r2(swap), net_profit: r2(gross + comm + swap) } as TT);
  }
  return out.sort((a, b) => b.close_time.localeCompare(a.close_time));
}

type TT = T & { account_id: string; id: string; commission?: number; swap?: number; profit?: number };
type Acc = { id: string; login: number; nickname: string | null; broker: string; platform: string; balance: number; currency: string; fund_target?: number | null; fund_max_daily?: number | null; fund_max_total?: number | null; fund_start?: number | null; acc_type?: string | null; challenge_status?: string | null; challenge_cost?: number | null };
type Lang = 'es' | 'en';
type View = 'hub' | 'rendimiento' | 'calendario' | 'operaciones' | 'costes' | 'cuentas' | 'reto' | 'plan';

function money(n: number, dec = 0) { return (n >= 0 ? '+$' : '-$') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: dec }); }
function money2(n: number) { return (n >= 0 ? '+$' : '-$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
const GREEN = 'var(--green)', RED = 'var(--red)', BLUE = 'var(--brand)', PURPLE = 'var(--purple)', GOLD = 'var(--gold)', CYAN = 'var(--cyan)';

const WDL = { es: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] };
const WDS = { es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
const MOL = { es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
const DAYH = { es: ['L', 'M', 'X', 'J', 'V', 'S', 'D'], en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'] };
const SESS: Record<string, { es: string; en: string }> = { 'Londres': { es: 'Londres', en: 'London' }, 'Nueva York': { es: 'Nueva York', en: 'New York' }, 'Asia': { es: 'Asia', en: 'Asia' } };

const D = {
  es: {
    nav_dash: 'Panel', nav_connect: 'Conectar cuenta', nav_plan: 'Plan', nav_account: 'Mi cuenta', nav_manager: 'Onyx Guardian', signout: 'Salir',
    ambT: '¿Tienes comunidad? Gana con Onyx', ambD: 'Cobra una comisión recurrente por cada persona que se suscriba con tu enlace, y dale un descuento a tu gente.', ambCta: 'Ver el programa →', ambHide: 'Ocultar',
    analytics: 'Tu panel', accountsWord: 'cuenta(s)', balance: 'Balance', connectBtn: '+ Conectar cuenta',
    greetM: 'Buenos días', greetA: 'Buenas tardes', greetE: 'Buenas noches', welcomeTrader: 'Bienvenido, trader', completeProfile: 'Completa tu perfil de trader →',
    styleMap: { scalping: 'Scalper', day: 'Day Trader', swing: 'Swing Trader', position: 'Position Trader', algo: 'Algo Trader' } as Record<string, string>,
    rankMap: { novato: 'Aprendiz', intermedio: 'Intermedio', avanzado: 'Avanzado', pro: 'Pro' } as Record<string, string>,
    goalMap: { pasar_challenge: 'Pasar challenge', consistencia: 'Consistencia', crecer: 'Crecer la cuenta', vivir: 'Vivir del trading' } as Record<string, string>,
    empty1_t: 'Conecta tu primera cuenta', empty1_d: 'Elige tu plataforma ({plats}), instala el conector, genera una API key y en segundos verás aquí todas tus estadísticas.', empty1_cta: 'Conectar cuenta →',
    empty2: 'Cuenta conectada. En cuanto cierres operaciones, aparecerán aquí tus analíticas.',
    portfolio: 'Portafolio', updated: 'Actualizado hace', sAgo: 's', now: 'ahora mismo',
    insights: '💡 Onyx te dice', health: 'Salud de la cuenta', back: '← Volver al panel',
    secPerf: 'Rendimiento', secPerfSub: 'KPIs, equity, pares y horas', secCal: 'Calendario', secCalSub: 'P&L por día y mes',
    secOps: 'Operaciones', secOpsSub: 'Diario, filtros y lotaje', secCost: 'Costes', secCostSub: 'Comisión y swap', secAcc: 'Cuentas', secAccSub: 'Fondeo, retiros y comparar',
    secReto: 'Mi reto', secRetoSub: '¿Sigues pasando el challenge?',
    kNet: 'Ganancia neta', kWR: 'Win rate', kPF: 'Profit factor', kExp: 'Expectancy', kAvgW: 'Ganancia media', kAvgL: 'Pérdida media', kPayoff: 'Payoff', kDur: 'Duración media', kOps: 'Operaciones', kBest: 'Mejor trade', kWorst: 'Peor trade', kBE: 'Break even',
    equity: 'Curva de equity', notEnough: 'Aún no hay suficientes operaciones.', ddMax: 'Drawdown máx:', streakMax: 'Racha máx:',
    donutTitle: 'Resultado de operaciones', dWin: 'Ganadoras', dLoss: 'Perdedoras', dBE: 'Break even', dCenter: 'ganadoras',
    pExitTitle: 'Salidas · Full TP vs parciales', pFullTP: 'Full TP', pFullTPsub: 'llegó al objetivo completo', pPartial: 'Cierre parcial', pPartialSub: 'cerró antes del objetivo', pPartialProfit: 'Ganancia parcial', pPartialProfitSub: 'banqueado en TP1/TP2', pRunner: 'Aporte del runner', pRunnerSub: 'lo que dejó correr', pReasons: 'Motivo de salida', rTP: 'Objetivo (TP)', rTrailing: 'Trailing', rManual: 'Manual', rSL: 'Stop (SL)', rSO: 'Stop out', rOther: 'Otro', pNoData: 'Actualiza tu EA a la última versión para ver el desglose de cierres parciales.',
    calTitle: 'Calendario de resultados', month: 'Mes', year: 'Año', monthTotal: 'Total mes:', ops: 'ops', dayOps: 'Operaciones del',
    bestDay: 'Mejor día', bestHour: 'Mejor hora', bestSess: 'Mejor sesión', bestPair: 'Mejor par', worstDay: 'Peor día', worstHour: 'Peor hora', worstSess: 'Peor sesión', worstPair: 'Peor par',
    lsTitle: 'Largos vs Cortos', longs: '🟢 Largos', shorts: '🔴 Cortos', distTitle: 'Distribución de resultados', noData: 'Sin datos.',
    topPairsT: 'Top 5 mejores pares', botPairsT: 'Top 5 peores pares', noPos: 'Sin pares en positivo.', noNeg: 'Sin pares en negativo.',
    byWeekday: 'Por día de la semana', bySession: 'Por sesión', byHour: 'Por hora del día', byMonth: 'Por mes',
    accCard: 'Cuentas y portafolio', balTotal: 'Balance total', accounts: 'Cuentas', opsTotal: 'Operaciones', th_acc: 'Cuenta', th_broker: 'Bróker', th_bal: 'Balance', th_net: 'Neto', th_win: 'Win', nickPh: 'Ej: FTMO 50K', nameBtn: '✏️ Nombre',
    fundTitle: '🏆 Reglas de fondeo', fundEdit: '⚙️ Configurar reglas', fundHide: 'Ocultar', fundTarget: 'Objetivo de fondeo ($)', fundMaxDaily: 'Pérdida diaria máx ($)', fundMaxTotal: 'Pérdida total máx ($)', fundStart: 'Balance inicial ($)', fundSave: 'Guardar reglas', fundProfitBar: 'Progreso al objetivo de fondeo', fundDDBar: 'Uso de pérdida máxima', fundHint: 'El profit que te pide tu cuenta de fondeo.',
    ranges: { d1: 'Hoy', d7: '7d', d30: '30d', mo: 'Mes', yr: 'Año', all: 'Todo' },
    radarTitle: 'Perfil del trader', bubbleTitle: 'Pares · volumen y resultado', rWR: 'Win rate', rPF: 'P. factor', rPayoff: 'Payoff', rConsist: 'Consistencia', rRisk: 'Riesgo', demo: 'Demo', demoOn: '🎬 Viendo datos de ejemplo (no reales)', customRange: 'Rango de fechas', from: 'Desde', to: 'Hasta',
    proLockT: 'Función Pro', proLockD: 'Mejora tu plan para desbloquear esta sección.', proLockCta: 'Ver planes →', histCap: '🔒 En el plan Free ves solo los últimos 30 días. Desbloquea tu historial completo con Pro.', available: 'Disponible en', upgradeTo: 'Mejorar a', perMo: 'mes', dLock1: 'Diario con fotos, notas y etiquetas por operación.', dLock2: 'Compara tus cuentas lado a lado.', dLock3: 'Reglas de fondeo, retiros y documentos de la cuenta.',
  },
  en: {
    nav_dash: 'Dashboard', nav_connect: 'Connect account', nav_plan: 'Plan', nav_account: 'My account', nav_manager: 'Onyx Guardian', signout: 'Sign out',
    ambT: 'Got a community? Earn with Onyx', ambD: 'Earn a recurring commission for everyone who subscribes through your link, and give your people a discount.', ambCta: 'See the program →', ambHide: 'Hide',
    analytics: 'Your dashboard', accountsWord: 'account(s)', balance: 'Balance', connectBtn: '+ Connect account',
    greetM: 'Good morning', greetA: 'Good afternoon', greetE: 'Good evening', welcomeTrader: 'Welcome, trader', completeProfile: 'Complete your trader profile →',
    styleMap: { scalping: 'Scalper', day: 'Day Trader', swing: 'Swing Trader', position: 'Position Trader', algo: 'Algo Trader' } as Record<string, string>,
    rankMap: { novato: 'Rookie', intermedio: 'Intermediate', avanzado: 'Advanced', pro: 'Pro' } as Record<string, string>,
    goalMap: { pasar_challenge: 'Pass challenge', consistencia: 'Consistency', crecer: 'Grow account', vivir: 'Trade for a living' } as Record<string, string>,
    empty1_t: 'Connect your first account', empty1_d: 'Pick your platform ({plats}), install the connector, generate an API key and in seconds all your stats will show up here.', empty1_cta: 'Connect account →',
    empty2: 'Account connected. As soon as you close trades, your analytics will appear here.',
    portfolio: 'Portfolio', updated: 'Updated', sAgo: 's ago', now: 'just now',
    insights: '💡 Onyx says', health: 'Account health', back: '← Back to dashboard',
    secPerf: 'Performance', secPerfSub: 'KPIs, equity, pairs and hours', secCal: 'Calendar', secCalSub: 'P&L by day and month',
    secOps: 'Trades', secOpsSub: 'Journal, filters and lots', secCost: 'Costs', secCostSub: 'Commission and swap', secAcc: 'Accounts', secAccSub: 'Funding, payouts and compare',
    secReto: 'My challenge', secRetoSub: 'Are you still passing?',
    kNet: 'Net profit', kWR: 'Win rate', kPF: 'Profit factor', kExp: 'Expectancy', kAvgW: 'Avg win', kAvgL: 'Avg loss', kPayoff: 'Payoff', kDur: 'Avg duration', kOps: 'Trades', kBest: 'Best trade', kWorst: 'Worst trade', kBE: 'Break even',
    equity: 'Equity curve', notEnough: 'Not enough trades yet.', ddMax: 'Max drawdown:', streakMax: 'Max streak:',
    donutTitle: 'Trade outcome', dWin: 'Winners', dLoss: 'Losers', dBE: 'Break even', dCenter: 'winners',
    pExitTitle: 'Exits · Full TP vs partials', pFullTP: 'Full TP', pFullTPsub: 'reached the full target', pPartial: 'Partial close', pPartialSub: 'closed before target', pPartialProfit: 'Partial profit', pPartialProfitSub: 'banked at TP1/TP2', pRunner: 'Runner contribution', pRunnerSub: 'what you let run', pReasons: 'Exit reason', rTP: 'Target (TP)', rTrailing: 'Trailing', rManual: 'Manual', rSL: 'Stop (SL)', rSO: 'Stop out', rOther: 'Other', pNoData: 'Update your EA to the latest version to see the partial-close breakdown.',
    calTitle: 'Results calendar', month: 'Month', year: 'Year', monthTotal: 'Month total:', ops: 'trades', dayOps: 'Trades on',
    bestDay: 'Best day', bestHour: 'Best hour', bestSess: 'Best session', bestPair: 'Best pair', worstDay: 'Worst day', worstHour: 'Worst hour', worstSess: 'Worst session', worstPair: 'Worst pair',
    lsTitle: 'Longs vs Shorts', longs: '🟢 Longs', shorts: '🔴 Shorts', distTitle: 'Results distribution', noData: 'No data.',
    topPairsT: 'Top 5 best pairs', botPairsT: 'Top 5 worst pairs', noPos: 'No pairs in profit.', noNeg: 'No pairs in loss.',
    byWeekday: 'By weekday', bySession: 'By session', byHour: 'By hour of day', byMonth: 'By month',
    accCard: 'Accounts & portfolio', balTotal: 'Total balance', accounts: 'Accounts', opsTotal: 'Trades', th_acc: 'Account', th_broker: 'Broker', th_bal: 'Balance', th_net: 'Net', th_win: 'Win', nickPh: 'e.g. FTMO 50K', nameBtn: '✏️ Name',
    fundTitle: '🏆 Prop-firm rules', fundEdit: '⚙️ Set rules', fundHide: 'Hide', fundTarget: 'Prop-firm target ($)', fundMaxDaily: 'Max daily loss ($)', fundMaxTotal: 'Max total loss ($)', fundStart: 'Starting balance ($)', fundSave: 'Save rules', fundProfitBar: 'Progress to prop-firm target', fundDDBar: 'Max loss used', fundHint: 'The profit your prop firm requires.',
    ranges: { d1: 'Today', d7: '7d', d30: '30d', mo: 'Month', yr: 'Year', all: 'All' },
    radarTitle: 'Trader profile', bubbleTitle: 'Pairs · volume and result', rWR: 'Win rate', rPF: 'P. factor', rPayoff: 'Payoff', rConsist: 'Consistency', rRisk: 'Risk', demo: 'Demo', demoOn: '🎬 Viewing example data (not real)', customRange: 'Date range', from: 'From', to: 'To',
    proLockT: 'Pro feature', proLockD: 'Upgrade your plan to unlock this section.', proLockCta: 'See plans →', histCap: '🔒 On the Free plan you see only the last 30 days. Unlock your full history with Pro.', available: 'Available in', upgradeTo: 'Upgrade to', perMo: 'mo', dLock1: 'Trade journal with photos, notes and tags.', dLock2: 'Compare your accounts side by side.', dLock3: 'Funding rules, payouts and account documents.',
  },
} as const;

function BarRow({ label, b, max, ops }: { label: string; b: Bucket; max: number; ops: string }) {
  const pct = max > 0 ? Math.abs(b.net) / max : 0;
  const grad = b.net >= 0 ? 'linear-gradient(90deg,var(--green2),var(--green))' : 'linear-gradient(90deg,var(--red2),var(--red))';
  const wr = b.count ? Math.round(100 * b.wins / b.count) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '7px 0' }}>
      <div style={{ width: 74, fontSize: 13, color: 'var(--mut)' }}>{label}</div>
      <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 8, height: 22, position: 'relative', overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(4, pct * 100)}%`, height: '100%', background: grad, borderRadius: 8, boxShadow: b.net >= 0 ? '0 0 12px -2px rgba(52,226,160,.65)' : '0 0 12px -2px rgba(255,107,125,.65)' }} />
        <span style={{ position: 'absolute', right: 8, top: 3, fontSize: 12, fontWeight: 700, color: '#fff' }}>{money(b.net)}</span>
      </div>
      <div style={{ width: 82, fontSize: 12, color: 'var(--mut)', textAlign: 'right' }}>{b.count} {ops} · {wr}%</div>
    </div>
  );
}
function Card({ title, icon, children, right }: any) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 9 }}>{icon ? <span className="card-ic">{typeof icon === 'string' ? <OnyxIcon emoji={icon} size={16} /> : icon}</span> : null} {title}</h3>{right}
      </div>{children}
    </div>
  );
}
function Donut({ win, loss, be, L }: { win: number; loss: number; be: number; L: any }) {
  const total = win + loss + be || 1;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative' }}>
        <MiniDonut size={150} segs={[{ v: win, c: GREEN }, { v: loss, c: RED }, { v: be, c: GOLD }]} />
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div><div style={{ fontSize: 26, fontWeight: 800 }}>{Math.round(100 * win / total)}%</div><div className="muted" style={{ fontSize: 11 }}>{L.dCenter}</div></div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[{ v: win, c: GREEN, l: L.dWin }, { v: loss, c: RED, l: L.dLoss }, { v: be, c: GOLD, l: L.dBE }].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: s.c }} /><span style={{ color: 'var(--mut)', width: 96 }}>{s.l}</span><b>{s.v}</b><span className="muted">({Math.round(100 * s.v / total)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function FundCard({ acc, net, maxDD, L, onSave }: { acc: Acc; net: number; maxDD: number; L: any; onSave: (f: any) => void }) {
  const hasRules = !!(acc.fund_target || acc.fund_max_total);
  const [edit, setEdit] = useState(!hasRules);
  const [f, setF] = useState<any>({ fund_target: acc.fund_target ?? '', fund_max_daily: acc.fund_max_daily ?? '', fund_max_total: acc.fund_max_total ?? '', fund_start: acc.fund_start ?? '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  async function save() { setSaving(true); await fetch('/api/accounts', { method: 'PATCH', body: JSON.stringify({ id: acc.id, ...f }) }); setSaving(false); onSave(f); setEdit(false); }
  const target = Number(acc.fund_target) || 0, maxTotal = Number(acc.fund_max_total) || 0;
  const tp = target > 0 ? Math.max(0, Math.min(100, (net / target) * 100)) : 0;
  const dd = maxTotal > 0 ? Math.min(100, (maxDD / maxTotal) * 100) : 0;
  const lbl = { fontSize: 12, color: 'var(--mut)', margin: '8px 0 4px', display: 'block' } as any;
  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 12 }}><h3>{L.fundTitle}</h3><button className="btn btn-ghost" onClick={() => setEdit(!edit)}>{edit ? L.fundHide : L.fundEdit}</button></div>
      {hasRules && (<>
        <div className="row between" style={{ fontSize: 13, marginBottom: 4 }}><span className="muted">{L.fundProfitBar}</span><span style={{ fontWeight: 700 }}>{Math.round(tp)}%</span></div>
        <div style={{ height: 10, background: 'var(--bg2)', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}><div style={{ width: tp + '%', height: '100%', borderRadius: 8, background: 'var(--green)', boxShadow: '0 0 12px -2px rgba(52,226,160,.7)' }} /></div>
        <div className="row between" style={{ fontSize: 13, marginBottom: 4 }}><span className="muted">{L.fundDDBar}</span><span style={{ fontWeight: 700 }}>{Math.round(dd)}%</span></div>
        <div style={{ height: 10, background: 'var(--bg2)', borderRadius: 8, overflow: 'hidden' }}><div style={{ width: dd + '%', height: '100%', borderRadius: 8, background: dd > 70 ? 'var(--red)' : '#ffcf5c', boxShadow: dd > 70 ? '0 0 12px -2px rgba(255,107,125,.7)' : '0 0 12px -2px rgba(255,207,92,.6)' }} /></div>
      </>)}
      {edit && (<div style={{ marginTop: hasRules ? 16 : 0 }}>
        <div className="grid g2">
          <div><span style={lbl}>{L.fundTarget}</span><input type="number" value={f.fund_target} onChange={(e) => set('fund_target', e.target.value)} style={{ margin: 0 }} /><span className="muted" style={{ fontSize: 11.5, display: 'block', marginTop: 4 }}>{L.fundHint}</span></div>
          <div><span style={lbl}>{L.fundMaxTotal}</span><input type="number" value={f.fund_max_total} onChange={(e) => set('fund_max_total', e.target.value)} style={{ margin: 0 }} /></div>
          <div><span style={lbl}>{L.fundMaxDaily}</span><input type="number" value={f.fund_max_daily} onChange={(e) => set('fund_max_daily', e.target.value)} style={{ margin: 0 }} /></div>
          <div><span style={lbl}>{L.fundStart}</span><input type="number" value={f.fund_start} onChange={(e) => set('fund_start', e.target.value)} style={{ margin: 0 }} /></div>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={save} disabled={saving}>{saving ? '...' : L.fundSave}</button>
      </div>)}
    </div>
  );
}

// Candado con vista previa difuminada: se ve el valor de la función, no solo el cerrojo.
function ProLock({ L, plan = 'Pro', desc, price, preview }: { L: any; plan?: string; desc?: string; price?: number; preview?: any }) {
  const col = plan === 'Elite' ? 'var(--green)' : 'var(--brand2)';
  return (
    <div className="card" style={{ padding: 22, position: 'relative', overflow: 'hidden' }}>
      {preview && (
        <div style={{ filter: 'blur(4px)', opacity: .45, pointerEvents: 'none', userSelect: 'none', marginBottom: 6 }} aria-hidden="true">
          {preview}
        </div>
      )}
      <div style={{ textAlign: 'center', paddingTop: preview ? 6 : 16, paddingBottom: preview ? 6 : 16 }}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>🔒</div>
        <h3 style={{ marginBottom: 6 }}>{L.available} <span style={{ color: col }}>{plan}</span></h3>
        <p className="muted" style={{ marginBottom: 16 }}>{desc || L.proLockD}</p>
        <Link className="btn btn-primary" href="/pricing">{L.upgradeTo} {plan}{price ? ` · $${price}/${L.perMo}` : ''} →</Link>
      </div>
    </div>
  );
}

// Muestras falsas (borrosas) para que se intuya qué hay detrás del candado
function PreviewJournal() {
  return (
    <div>
      {[['EURUSD', '+142.50', 'var(--green)'], ['US30', '-68.20', 'var(--red)'], ['XAUUSD', '+310.00', 'var(--green)']].map(([s, v, c], i) => (
        <div key={i} className="row between" style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
          <div className="row" style={{ gap: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--card2)' }} />
            <div><div style={{ fontWeight: 700 }}>{s}</div><div className="muted" style={{ fontSize: 12 }}>12:40 · 0.50 lotes</div></div>
          </div>
          <b style={{ color: c as string }}>{v}</b>
        </div>
      ))}
    </div>
  );
}
function PreviewCompare() {
  return (
    <div className="grid g3" style={{ gap: 12 }}>
      {[['FTMO 100K', '+2,410', 'var(--green)'], ['The5ers', '-380', 'var(--red)'], ['Axi real', '+915', 'var(--green)']].map(([n, v, c], i) => (
        <div key={i}><div className="muted" style={{ fontSize: 12 }}>{n}</div><div style={{ fontSize: 20, fontWeight: 800, color: c as string }}>{v}</div><div style={{ height: 40, background: 'var(--card2)', borderRadius: 8, marginTop: 6 }} /></div>
      ))}
    </div>
  );
}
function PreviewFunding() {
  return (
    <div>
      {[['Objetivo', 72, 'var(--green)'], ['Pérdida diaria', 28, 'var(--amber)'], ['Pérdida total', 41, 'var(--brand)']].map(([n, p, c], i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div className="row between" style={{ fontSize: 13, marginBottom: 4 }}><span>{n as string}</span><span className="muted">{p as number}%</span></div>
          <div style={{ height: 7, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden' }}><div style={{ width: (p as number) + '%', height: '100%', background: c as string }} /></div>
        </div>
      ))}
    </div>
  );
}
function PlanBadge({ plan }: { plan: string }) {
  const elite = plan === 'Elite';
  return <span style={{ fontSize: 10, fontWeight: 800, background: elite ? 'rgba(52,226,160,.15)' : 'rgba(160,107,255,.2)', color: elite ? 'var(--soft-green)' : 'var(--soft-purple)', border: '1px solid ' + (elite ? 'var(--green)' : 'var(--brand2)'), borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>🔒 {plan.toUpperCase()}</span>;
}

export default function DashboardClient({ email = '', plan = 'free', capOverride, profile, trades = [], accounts: accs0 = [] }: { email?: string; plan?: string; capOverride?: Record<string, any>; profile?: { full_name?: string; trade_style?: string; experience?: string; platform?: string; goal?: string }; trades?: TT[]; accounts?: Acc[] }) {
  const isFree = (plan || 'free') === 'free';
  const { lang, setLang } = useLang();
  const [accounts, setAccounts] = useState<Acc[]>(accs0 || []);
  const [tradesS, setTradesS] = useState<TT[]>(trades || []);
  const [sel, setSel] = useState<string>('all');
  const [view, setView] = useState<View>('hub');
  // Recordatorio de check-in del plan → píldora iluminada en la cápsula del saludo.
  const [checkin, setCheckin] = useState<{ pending: boolean; open: () => void } | null>(null);
  // Deep-link: /dashboard?view=plan abre directo esa vista (p.ej. desde el Guardian).
  useEffect(() => {
    try {
      const v = new URLSearchParams(window.location.search).get('view');
      const ok: View[] = ['hub', 'rendimiento', 'calendario', 'operaciones', 'costes', 'cuentas', 'reto', 'plan'];
      if (v && (ok as string[]).includes(v)) setView(v as View);
    } catch {}
  }, []);
  const [range, setRange] = useState<string>('all');
  const [cFrom, setCFrom] = useState('');
  const [cTo, setCTo] = useState('');
  const [demo, setDemo] = useState(false);
  const demoTrades = useMemo(() => genDemo(accs0[0]?.id || 'demo'), []);
  const [editing, setEditing] = useState<string>('');
  const [nick, setNick] = useState('');
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [, setTick] = useState(0);
  const [plans, setPlans] = useState<any[]>([]);
  const [limitInfo, setLimitInfo] = useState<any>(null);
  const L = dictFor(D, lang);
  const platItems = useCatalog('platform');
  const proPrice = plans.find((p: any) => p.id === 'pro')?.price_month || 0;

  // Capacidades del plan actual (controladas 100% desde el panel). Antes de cargar, cae al comportamiento por defecto (free vs pago).
  const myPlan = plans.find((p: any) => p.id === (plan || 'free'));
  const baseCaps = myPlan?.capabilities && typeof myPlan.capabilities === 'object' ? myPlan.capabilities : null;
  // Onyx Guardian puede venir concedido por un nivel VIP de academia (capOverride).
  const caps = (baseCaps || capOverride) ? { ...(baseCaps || {}), ...(capOverride || {}) } : null;
  const histDays = caps ? (Number(caps.history_days) || 0) : (isFree ? 30 : 0); // 0 = ilimitado
  const canJournal = caps ? !!caps.journal : !isFree;
  const canCompare = caps ? !!caps.compare : !isFree;
  const canFunding = caps ? !!caps.funding : !isFree;
  // Plan más barato (distinto al actual) que desbloquea una capacidad → para el candado y su precio.
  const upsell = (capKey: string) => {
    const cands = plans.filter((p: any) => p.id !== (plan || 'free') && p.capabilities?.[capKey] && p.active !== false).sort((x: any, y: any) => (x.price_month || 0) - (y.price_month || 0));
    const t = cands[0] || plans.find((p: any) => p.id === 'pro');
    return { name: t?.name || 'Pro', price: t?.price_month || proPrice };
  };
  const upJ = upsell('journal'), upC = upsell('compare'), upF = upsell('funding');

  // Ata al usuario con el embajador que lo trajo (si viene de un enlace)
  useEffect(() => { fetch('/api/ref', { method: 'POST' }).catch(() => {}); }, []);

  // Límite real de cuentas (incluye las compradas como complemento)
  useEffect(() => { fetch('/api/keys').then((r) => r.json()).then((j) => setLimitInfo(j.usage || null)).catch(() => {}); }, []);

  useEffect(() => { fetch('/api/admin/plans').then((r) => r.json()).then((j) => setPlans(j.plans || [])).catch(() => {}); }, []);

  useEffect(() => {
  }, []);

  // Auto-refresco cada 30s + al volver a la pestaña
  useEffect(() => {
    let stop = false;
    async function refresh() {
      try { const r = await fetch('/api/dashboard'); const j = await r.json(); if (!stop && j.trades) { setTradesS(j.trades); if (j.accounts) setAccounts(j.accounts); setLastUpdate(Date.now()); } } catch {}
    }
    const iv = setInterval(refresh, 30000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => { stop = true; clearInterval(iv); window.removeEventListener('focus', onFocus); };
  }, []);
  useEffect(() => { const iv = setInterval(() => setTick((t) => t + 1), 5000); return () => clearInterval(iv); }, []);

  const secsAgo = Math.max(0, Math.round((Date.now() - lastUpdate) / 1000));
  const updatedTxt = secsAgo < 5 ? L.now : `${L.updated} ${secsAgo < 60 ? secsAgo + L.sAgo : Math.round(secsAgo / 60) + 'm'}`;

  // filtro de tiempo
  const ranged = useMemo(() => {
    const now = Date.now();
    const src = demo ? demoTrades : tradesS;
    const histCap = histDays > 0 && !demo ? now - histDays * 864e5 : -Infinity; // límite de historial según el plan
    return src.filter((x) => {
      const dt = new Date(x.close_time); const d = dt.getTime();
      if (d < histCap) return false;
      if (range === 'custom') { const ds = x.close_time.slice(0, 10); if (cFrom && ds < cFrom) return false; if (cTo && ds > cTo) return false; return true; }
      if (range === 'd1') return d >= now - 864e5;
      if (range === 'd7') return d >= now - 7 * 864e5;
      if (range === 'd30') return d >= now - 30 * 864e5;
      if (range === 'mo') { const n = new Date(); return dt.getUTCFullYear() === n.getUTCFullYear() && dt.getUTCMonth() === n.getUTCMonth(); }
      if (range === 'yr') return dt.getUTCFullYear() === new Date().getUTCFullYear();
      return true;
    });
  }, [tradesS, demo, demoTrades, range, cFrom, cTo, histDays]);

  // Fechas (YYYY-MM-DD) del filtro activo. UN SOLO control de fecha manda: alimenta
  // al Coach y al export, para que "filtrar" signifique lo mismo en toda la pantalla.
  const rangeDates = useMemo<{ from?: string; to?: string }>(() => {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const now = new Date();
    if (range === 'custom') return { from: cFrom || undefined, to: cTo || undefined };
    if (range === 'd1') return { from: iso(new Date(Date.now() - 864e5)) };
    if (range === 'd7') return { from: iso(new Date(Date.now() - 7 * 864e5)) };
    if (range === 'd30') return { from: iso(new Date(Date.now() - 30 * 864e5)) };
    if (range === 'mo') return { from: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))) };
    if (range === 'yr') return { from: iso(new Date(Date.UTC(now.getUTCFullYear(), 0, 1))) };
    return {}; // 'all' → sin límite (el Coach cae a 90 días)
  }, [range, cFrom, cTo]);
  // URLs de descarga del reporte para el período filtrado (con topes seguros).
  const expFrom = rangeDates.from || '2000-01-01';
  const expTo = rangeDates.to || new Date().toISOString().slice(0, 10);
  const pdfHref = `/api/dashboard/report?from=${expFrom}&to=${expTo}&lang=${lang}`;
  const csvHref = `/api/dashboard/report?export=csv&from=${expFrom}&to=${expTo}&lang=${lang}`;

  // Cuántas operaciones suyas quedan fuera por el límite de historial de su plan
  const hiddenTrades = useMemo(() => {
    if (!histDays || demo) return 0;
    const cut = Date.now() - histDays * 864e5;
    return tradesS.filter((x) => new Date(x.close_time).getTime() < cut).length;
  }, [tradesS, histDays, demo]);

  const filtered = useMemo(() => (sel === 'all' ? ranged : ranged.filter((t) => t.account_id === sel)), [ranged, sel]);
  const a = useMemo(() => analyze(filtered), [filtered]);

  const totalBalance = accounts.reduce((s, x) => s + Number(x.balance || 0), 0);
  const accName = (x: Acc) => x.nickname || `#${x.login}`;
  const sessName = (key: string) => (SESS[key] ? SESS[key][lang] : key);
  function accStats(id: string) { const ts = ranged.filter((t) => t.account_id === id); let net = 0, w = 0; for (const t of ts) { const p = +t.net_profit || 0; net += p; if (p >= 0) w++; } return { net, ops: ts.length, wr: ts.length ? Math.round(100 * w / ts.length) : 0 }; }
  async function saveNick(id: string) { await fetch('/api/accounts', { method: 'PATCH', body: JSON.stringify({ id, nickname: nick }) }); setAccounts(accounts.map((x) => (x.id === id ? { ...x, nickname: nick } : x))); setEditing(''); }

  const weekOrder = [1, 2, 3, 4, 5, 6, 0];
  const weekdayData = weekOrder.map((i) => ({ label: WDS[lang][i], b: a.byWeekday[String(i)] || { net: 0, count: 0, wins: 0 } }));
  const maxWD = Math.max(1, ...weekdayData.map((d) => Math.abs(d.b.net)));
  const hourData = Array.from({ length: 24 }, (_, h) => ({ label: `${h}h`, b: a.byHour[String(h)] || { net: 0, count: 0, wins: 0 } })).filter((d) => d.b.count > 0);
  const maxH = Math.max(1, ...hourData.map((d) => Math.abs(d.b.net)));
  const sessKeys = ['Londres', 'Nueva York', 'Asia'];
  const sessData = sessKeys.map((s) => ({ label: sessName(s), b: a.bySession[s] || { net: 0, count: 0, wins: 0 } }));
  const maxS = Math.max(1, ...sessData.map((d) => Math.abs(d.b.net)));
  const monthData = Object.keys(a.byMonth).sort().map((key) => { const [y, m] = key.split('-'); return { label: `${MOL[lang][+m - 1]} ${y.slice(2)}`, b: a.byMonth[key] }; });
  const maxM = Math.max(1, ...monthData.map((d) => Math.abs(d.b.net)));
  const top = topPairs(a.bySymbol, 5, false).filter(([, b]) => b.net > 0);
  const bot = topPairs(a.bySymbol, 5, true).filter(([, b]) => b.net < 0);
  const maxTop = Math.max(1, ...top.map(([, b]) => Math.abs(b.net)), ...bot.map(([, b]) => Math.abs(b.net)));
  const buy = a.bySide['buy'] || { net: 0, count: 0, wins: 0 }, sell = a.bySide['sell'] || { net: 0, count: 0, wins: 0 };
  const maxLS = Math.max(1, Math.abs(buy.net), Math.abs(sell.net));
  const bWD = bestOf(a.byWeekday), bH = bestOf(a.byHour), bS = bestOf(a.bySession), bSym = bestOf(a.bySymbol);
  const wWD = worstOf(a.byWeekday), wH = worstOf(a.byHour), wS = worstOf(a.bySession), wSym = worstOf(a.bySymbol);
  const maxHist = Math.max(1, ...a.hist.map((h) => h.count));

  const W = 680, H = 150; let path = '';
  if (a.equity.length > 1) {
    const min = Math.min(...a.equity.map((e) => e.v)), max = Math.max(...a.equity.map((e) => e.v)); const rng = (max - min) || 1;
    path = a.equity.map((e, i) => { const x = (i / (a.equity.length - 1)) * W; const y = H - ((e.v - min) / rng) * (H - 16) - 8; return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ');
  }

  const now = new Date();
  const [calY, setCalY] = useState(now.getUTCFullYear());
  const [calM, setCalM] = useState(now.getUTCMonth());
  const [vw, setVw] = useState<'mes' | 'ano'>('mes');
  const [selDay, setSelDay] = useState<string | null>(null);
  const daysInMonth = new Date(Date.UTC(calY, calM + 1, 0)).getUTCDate();
  const off = (new Date(Date.UTC(calY, calM, 1)).getUTCDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < off; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const dayKey = (d: number) => `${calY}-${String(calM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  let monthTotal = 0, monthTrades = 0;
  for (let d = 1; d <= daysInMonth; d++) { const b = a.daily[dayKey(d)]; if (b) { monthTotal += b.net; monthTrades += b.count; } }
  const maxDay = Math.max(1, ...Object.values(a.daily).map((b) => Math.abs(b.net)));
  const prevM = () => { const m = calM - 1; if (m < 0) { setCalM(11); setCalY(calY - 1); } else setCalM(m); setSelDay(null); };
  const nextM = () => { const m = calM + 1; if (m > 11) { setCalM(0); setCalY(calY + 1); } else setCalM(m); setSelDay(null); };
  const dayTrades = selDay ? filtered.filter((t) => t.close_time.slice(0, 10) === selDay).sort((x, y) => y.close_time.localeCompare(x.close_time)) : [];
  const cur = accounts.find((x) => x.id === sel);
  const curName = sel === 'all' ? L.portfolio : (cur ? accName(cur) : '');

  const hasAccounts = accounts.length > 0;
  const hasTrades = (demo ? demoTrades.length : tradesS.length) > 0;
  const hs = healthScore(a);

  // Perfil (radar) y burbujas de pares
  const radarAxes = [
    { label: L.rWR, val: a.winRate / 100 },
    { label: L.rPF, val: Math.min(a.profitFactor, 3) / 3 },
    { label: L.rPayoff, val: Math.min(a.payoff, 2) / 2 },
    { label: L.rConsist, val: a.n ? Math.max(0, 1 - (a.maxLoss / Math.max(3, a.n)) * 2) : 0 },
    { label: L.rRisk, val: Math.max(0, 1 - Math.min(1, a.maxDD / (Math.abs(a.net) + a.maxDD + 1))) },
  ];
  const bubbleData = useMemo(() => {
    const m: Record<string, { vol: number; net: number }> = {};
    for (const x of filtered) { const s = x.symbol; if (!m[s]) m[s] = { vol: 0, net: 0 }; m[s].vol += Math.abs(+x.volume || 0); m[s].net += +x.net_profit || 0; }
    const arr = Object.entries(m).map(([label, v]) => ({ label, vol: v.vol, net: v.net }));
    const mx = Math.max(1, ...arr.map((x) => x.vol));
    return arr.sort((a2, b2) => b2.vol - a2.vol).slice(0, 8).map((x) => ({ label: x.label, size: x.vol / mx, net: x.net }));
  }, [filtered]);

  const fundAlert = (() => {
    if (sel === 'all' || !cur) return null;
    const maxTotal = Number(cur.fund_max_total) || 0, target = Number(cur.fund_target) || 0;
    const es = lang === 'es';
    if (maxTotal > 0 && a.maxDD / maxTotal >= 0.8) return { type: 'danger', txt: es ? `⚠ Cuidado: has usado el ${Math.round(a.maxDD / maxTotal * 100)}% de tu pérdida máxima en ${accName(cur)}.` : `⚠ Careful: you've used ${Math.round(a.maxDD / maxTotal * 100)}% of your max loss on ${accName(cur)}.` };
    if (target > 0 && a.net / target >= 1) return { type: 'ok', txt: es ? `🎉 ¡Llegaste al objetivo de fondeo en ${accName(cur)}! (${money2(a.net)})` : `🎉 You hit the prop-firm target on ${accName(cur)}! (${money2(a.net)})` };
    return null;
  })();

  // Insights "Onyx te dice"
  const insights = useMemo(() => {
    const out: { icon: string; txt: string }[] = [];
    const es = lang === 'es';
    if (a.n > 0 && a.n < 8) out.push({ icon: '🌱', txt: es ? 'Aún tienes pocas operaciones: las estadísticas se afinan con más datos.' : 'Few trades yet: stats sharpen with more data.' });
    if (bS && bS[1].net > 0) out.push({ icon: '🌍', txt: es ? `Tu mejor sesión es ${sessName(bS[0])} (${money2(bS[1].net)})` : `Your best session is ${sessName(bS[0])} (${money2(bS[1].net)})` });
    if (wWD && wWD[1].net < 0) out.push({ icon: '📉', txt: es ? `Donde más pierdes: ${WDL[lang][+wWD[0]]}` : `Where you lose most: ${WDL[lang][+wWD[0]]}` });
    if (a.profitFactor >= 1.3) out.push({ icon: '⚖️', txt: es ? `Ganas $${a.profitFactor.toFixed(2)} por cada $1 arriesgado` : `You make $${a.profitFactor.toFixed(2)} per $1 risked` });
    else if (a.n >= 3 && a.net < 0) out.push({ icon: '⚠️', txt: es ? `Vas en pérdida: ganas en el ${Math.round(a.winRate)}% de tus operaciones.` : `You're at a loss: ${Math.round(a.winRate)}% of your trades are winners.` });
    const gross = filtered.reduce((s, x) => s + (+(x.profit ?? x.net_profit) || 0), 0);
    const cost = filtered.reduce((s, x) => s + ((+(x.commission || 0)) + (+(x.swap || 0))), 0);
    if (gross > 0 && cost < 0) out.push({ icon: '💸', txt: es ? `Los costes se comieron el ${Math.round(Math.abs(cost) / gross * 100)}% de tu ganancia bruta` : `Costs ate ${Math.round(Math.abs(cost) / gross * 100)}% of your gross profit` });
    if (bH && bH[1].net > 0) out.push({ icon: '⏰', txt: es ? `Tu mejor hora es las ${bH[0]}:00` : `Your best hour is ${bH[0]}:00` });
    if (!out.length) out.push({ icon: '📊', txt: es ? 'Opera y cierra posiciones para ver aquí tus patrones.' : 'Trade and close positions to see your patterns here.' });
    return out.slice(0, 4);
  }, [a, filtered, lang]);

  // datos para mini-gráficas del hub
  const heatCells = (() => { const arr: number[] = []; const mx = maxDay; for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5); const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; const b = a.daily[key]; arr.push(b ? b.net / mx : 0); } return arr; })();
  const eqVals = a.equity.map((e) => e.v);
  const grossAll = filtered.reduce((s, x) => s + (+(x.profit ?? x.net_profit) || 0), 0);
  const costAll = filtered.reduce((s, x) => s + ((+(x.commission || 0)) + (+(x.swap || 0))), 0);
  const eaten = grossAll > 0 ? Math.round(Math.min(100, Math.abs(costAll) / grossAll * 100)) : 0;

  const SECTIONS: { key: View; icon: string; label: string; sub: string; color: string; metric: string; mc: string; viz: any; pro?: boolean }[] = [
    { key: 'rendimiento', icon: '📈', label: L.secPerf, sub: L.secPerfSub, color: BLUE, metric: money2(a.net), mc: a.net >= 0 ? GREEN : RED, viz: <div style={{ width: 110 }}><MiniArea points={eqVals.length > 1 ? eqVals : [0, 0]} color={a.net >= 0 ? GREEN : RED} h={44} /></div> },
    { key: 'calendario', icon: '🗓️', label: L.secCal, sub: L.secCalSub, color: GREEN, metric: `${a.n} ${L.ops}`, mc: 'var(--tx)', viz: <div style={{ width: 110 }}><MiniHeat cells={heatCells} /></div> },
    { key: 'operaciones', icon: '📋', label: L.secOps, sub: L.secOpsSub, color: PURPLE, metric: String(a.n), mc: 'var(--tx)', viz: <MiniDonut size={46} segs={[{ v: a.catWin, c: GREEN }, { v: a.catLoss, c: RED }, { v: a.catBE, c: GOLD }]} />, pro: true },
    { key: 'costes', icon: '💸', label: L.secCost, sub: L.secCostSub, color: GOLD, metric: money2(costAll), mc: costAll >= 0 ? GREEN : RED, viz: <Ring size={46} pct={eaten / 100} color={GOLD} value={eaten + '%'} /> },
    { key: 'cuentas', icon: '🗂️', label: L.secAcc, sub: L.secAccSub, color: CYAN, metric: String(accounts.length), mc: 'var(--tx)', viz: <div style={{ width: 100 }}><MiniBars vals={accounts.length ? accounts.map((x) => accStats(x.id).net) : [1, 1]} colors={accounts.length ? accounts.map((x) => (accStats(x.id).net >= 0 ? GREEN : RED)) : [BLUE]} h={44} /></div> },
    { key: 'reto', icon: '🏁', label: L.secReto, sub: L.secRetoSub, color: GOLD, metric: '', mc: 'var(--tx)', viz: <div style={{ fontSize: 30, lineHeight: 1 }}>🏁</div> },
  ];

  const kpi = (lbl: string, val: string, cls = '') => <div className="card kpi"><div className="lbl">{lbl}</div><div className={'val ' + cls}>{val}</div></div>;

  // Saludo personalizado + credencial de trader (usa el perfil del onboarding).
  const firstName = (profile?.full_name || '').trim().split(/\s+/)[0] || '';
  const greetWord = (() => { const h = new Date().getHours(); return h < 12 ? L.greetM : h < 19 ? L.greetA : L.greetE; })();
  const heroTitle = firstName ? `${greetWord}, ${firstName}` : L.welcomeTrader;
  const heroInitials = (firstName || email || '?').slice(0, 2).toUpperCase();
  const STYLE_EMOJI: Record<string, string> = { scalping: '⚡', day: '📈', swing: '🌊', position: '🏔️', algo: '🤖' };
  const heroChips: { icon: string; label: string }[] = [];
  if (profile?.trade_style && L.styleMap[profile.trade_style]) heroChips.push({ icon: STYLE_EMOJI[profile.trade_style] || '📈', label: L.styleMap[profile.trade_style] });
  if (profile?.experience && L.rankMap[profile.experience]) heroChips.push({ icon: '🏅', label: L.rankMap[profile.experience] });
  if (profile?.platform && platformLabel(profile.platform, lang)) heroChips.push({ icon: '🖥️', label: platformLabel(profile.platform, lang) });
  if (profile?.goal && L.goalMap[profile.goal]) heroChips.push({ icon: '🎯', label: L.goalMap[profile.goal] });

  return (
    <>
      <DailyCheckinPopup lang={lang} onState={setCheckin} />

      <div className="wrap-wide" style={{ padding: '24px clamp(16px,1.6vw,40px)' }}>
        {/* Info del trader: alineada a la izquierda */}
        <div className="row between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div className="row" style={{ gap: 14, alignItems: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--grad)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, flex: 'none' }}>{heroInitials}</div>
            <div>
              <h1 style={{ marginBottom: 6, lineHeight: 1.15, display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{heroTitle} <span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="hand" size={22} /></span>
                {checkin?.pending && (
                  <button onClick={() => checkin.open()} title={lang === 'en' ? 'Review your plan today' : 'Revisa tu plan hoy'}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--amber)', background: 'rgba(245,158,11,.12)', color: 'var(--amber)', borderRadius: 16, padding: '4px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', animation: 'onyxGlow 1.9s ease-in-out infinite' }}>
                    <OnyxIcon emoji="⏳" size={13} /> {lang === 'en' ? 'Review plan' : 'Revisar plan'}
                  </button>
                )}
              </h1>
              {heroChips.length ? (
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {heroChips.map((c, i) => <span key={i} className="pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(124,140,255,.14)', color: 'var(--soft-brand)', fontWeight: 500 }}><OnyxIcon emoji={c.icon} size={13} /> {c.label}</span>)}
                </div>
              ) : (
                <Link href="/onboarding" className="pill" style={{ background: 'rgba(124,140,255,.14)', color: 'var(--soft-brand)' }}>{L.completeProfile}</Link>
              )}
            </div>
          </div>
          {/* El botón viejo de "Conectar cuenta" se quitó: ahora se usa el sistema
              nuevo de abajo (SetupGuide) — barra "Tus cuentas" + "Añadir cuenta". */}
        </div>
        <p className="muted" style={{ fontSize: 13, margin: '-6px 0 14px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{email} · {accounts.length} {L.accountsWord} · {L.balance} ${totalBalance.toLocaleString()} · <span className="livedot" style={{ width: 8, height: 8 }} /><span style={{ color: GREEN }}>{updatedTxt}</span></p>

        {/* Guía de configuración adaptativa (onboarding + añadir cuentas, con confirmación en vivo) */}
        <SetupGuide />

        {/* Ganancia neta + Onyx Coach: rejilla fluida (lado a lado en ancho, apiladas en móvil) */}
        {(caps?.expenses || caps?.coach) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12, alignItems: 'stretch', marginBottom: 14 }}>
            {caps?.expenses ? <NetRealCard /> : null}
            {caps?.coach ? <CoachCard from={rangeDates.from} to={rangeDates.to} account={sel} /> : null}
          </div>
        )}

        {!isFree && (
          <div className="card" style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: '12px 14px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--tx)' }}><OnyxIcon emoji="📄" size={15} /> {lang === 'es' ? 'Descargar reporte del período filtrado' : 'Download report for the filtered period'} <span className="muted" style={{ fontSize: 11 }}>· {lang === 'es' ? 'fondeo, impuestos o análisis' : 'funding, taxes or analysis'}</span></span>
            <span style={{ display: 'inline-flex', gap: 8 }}>
              <a className="btn btn-ghost" href={pdfHref} target="_blank" rel="noopener noreferrer" style={{ padding: '7px 13px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji="⬇️" size={14} /> PDF</a>
              <a className="btn btn-ghost" href={csvHref} target="_blank" rel="noopener noreferrer" style={{ padding: '7px 13px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji="⬇️" size={14} /> CSV</a>
            </span>
          </div>
        )}

        <div className="cockpit">
          <div className="rail-left"><MarketHours lang={lang} compact /><details style={{ marginTop: 12 }}><summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--tx)', padding: '10px 12px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8 }}><OnyxIcon name="lots" size={16} /> {lang === 'en' ? 'Lot size calculator' : 'Calculadora de lotes'}</summary><div style={{ marginTop: 10 }}><LotCalculator lang={lang} balance={Number(cur?.balance) || totalBalance || undefined} /></div></details></div>
          <div className="rail-right"><News lang={lang} /></div>
          <div className="center">
        {!hasAccounts ? (
          <div className="card" style={{ textAlign: 'center', padding: '30px 20px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{lang === 'en' ? 'Your stats will appear here' : 'Aquí aparecerán tus estadísticas'}</div>
            <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>{lang === 'en' ? 'Follow the setup guide above to connect your first account.' : 'Sigue la guía de arriba para conectar tu primera cuenta.'}</p>
          </div>
        ) : !hasTrades ? (
          <div className="card"><p className="muted">{L.empty2}</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: view === 'hub' ? undefined : 1160, margin: view === 'hub' ? undefined : '0 auto' }}>
            {/* controles: cuentas + filtro de tiempo */}
            <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className={'btn ' + (sel === 'all' ? 'btn-primary' : 'btn-ghost')} onClick={() => setSel('all')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><OnyxIcon emoji="📊" size={15} /> {L.portfolio}</button>
                {accounts.map((x) => <button key={x.id} className={'btn ' + (sel === x.id ? 'btn-primary' : 'btn-ghost')} onClick={() => setSel(x.id)}>{accName(x)}</button>)}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['d1', 'd7', 'd30', 'mo', 'yr', 'all'] as const).map((r) => <button key={r} className={'btn ' + (range === r ? 'btn-primary' : 'btn-ghost')} style={{ padding: '7px 12px' }} onClick={() => setRange(r)}>{L.ranges[r]}</button>)}
                <button className={'btn ' + (range === 'custom' ? 'btn-primary' : 'btn-ghost')} style={{ padding: '7px 12px', display: 'inline-flex', alignItems: 'center' }} onClick={() => setRange('custom')} title={L.customRange}><OnyxIcon emoji="📅" size={15} /></button>
                <button className={'btn ' + (demo ? 'btn-primary' : 'btn-ghost')} style={{ padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setDemo(!demo)}><OnyxIcon emoji="🎬" size={15} /> {L.demo}</button>
              </div>
            </div>
            {range === 'custom' && (
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignSelf: 'flex-start' }}>
                <span className="muted" style={{ fontSize: 13 }}>{L.from}</span>
                <input type="date" value={cFrom} onChange={(e) => setCFrom(e.target.value)} style={{ margin: 0, width: 'auto', padding: '7px 9px' }} />
                <span className="muted" style={{ fontSize: 13 }}>{L.to}</span>
                <input type="date" value={cTo} onChange={(e) => setCTo(e.target.value)} style={{ margin: 0, width: 'auto', padding: '7px 9px' }} />
              </div>
            )}
            {demo && <div style={{ background: 'rgba(255,192,77,.12)', border: '1px solid var(--amber)', color: 'var(--amber)', borderRadius: 10, padding: '8px 14px', fontSize: 13, alignSelf: 'flex-start' }}>{L.demoOn}</div>}
            {fundAlert && <div style={{ background: fundAlert.type === 'danger' ? 'rgba(255,107,125,.12)' : 'rgba(52,226,160,.12)', border: '1px solid ' + (fundAlert.type === 'danger' ? 'var(--red)' : 'var(--green)'), color: fundAlert.type === 'danger' ? 'var(--red)' : 'var(--green)', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 600 }}>{fundAlert.txt}</div>}
            {histDays > 0 && <div style={{ background: 'rgba(124,140,255,.10)', border: '1px solid var(--brand)', color: 'var(--soft-brand2)', borderRadius: 10, padding: '9px 14px', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{L.histCap} <Link href="/pricing" style={{ color: '#fff', fontWeight: 700 }}>{L.proLockCta}</Link></div>}

            {view === 'hub' && (<>
              <ReferralBanner />
              {/* Onyx te dice — tira compacta de consejos (una sola fila que hace scroll) */}
              {insights.length > 0 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 2 }}>
                  <span className="muted" style={{ fontSize: 12, fontWeight: 700, flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--brand)' }}><OnyxIcon emoji="💡" size={15} /> {L.insights}</span>
                  {insights.map((x, i) => (
                    <span key={i} style={{ display: 'inline-flex', gap: 7, alignItems: 'center', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 999, padding: '6px 12px', fontSize: 12.5, whiteSpace: 'nowrap', flex: 'none' }}>
                      <span style={{ display: 'inline-flex', color: 'var(--brand)' }}><OnyxIcon emoji={x.icon} size={14} /></span>{x.txt}
                    </span>
                  ))}
                </div>
              )}

              {/* Cabecera vital: anillos encendidos + mosaicos de navegación */}
              {(() => {
                const semWR = a.winRate >= 50 ? GREEN : a.winRate >= 40 ? GOLD : RED;
                const semPF = a.profitFactor >= 1.3 ? GREEN : a.profitFactor >= 1 ? GOLD : RED;
                const semPO = a.payoff >= 1.5 ? GREEN : a.payoff >= 1 ? GOLD : RED;
                const vitals: Vital[] = [
                  { pct: hs.score / 100, color: hs.color, value: String(hs.score), label: L.health },
                  { pct: a.winRate / 100, color: semWR, value: `${Math.round(a.winRate)}%`, label: L.kWR },
                  { pct: Math.min(a.profitFactor, 3) / 3, color: semPF, value: a.profitFactor.toFixed(2), label: L.kPF },
                  { pct: Math.min(a.payoff, 2) / 2, color: semPO, value: a.payoff.toFixed(2), label: L.rPayoff },
                ];
                const tiles: Tile[] = SECTIONS.map((s) => ({
                  key: s.key, icon: s.icon, label: s.label, metric: s.metric, mc: s.mc, color: s.color,
                  onClick: () => setView(s.key),
                  badge: s.pro && !canJournal ? <PlanBadge plan={upJ.name} /> : undefined,
                }));
                tiles.push({ key: 'plan', icon: '🎯', label: lang === 'en' ? 'My plan' : 'Mi plan', metric: lang === 'en' ? 'Habits' : 'Hábitos', mc: 'var(--soft-brand)', color: PURPLE, onClick: () => setView('plan') });
                return <HubVitals net={money2(a.net)} netPos={a.net >= 0} netLabel={L.kNet} vitals={vitals} tiles={tiles} />;
              })()}

              <Achievements a={a} accounts={accounts} trades={demo ? demoTrades : tradesS} lang={lang} />

              <Nudge
                lang={lang}
                plans={plans}
                planId={plan || 'free'}
                histDays={histDays}
                canJournal={canJournal}
                hiddenTrades={hiddenTrades}
                totalTrades={tradesS.length}
                used={accounts.length}
                max={limitInfo ? Number(limitInfo.max) : Number(myPlan?.max_accounts || 1)}
                unlimited={limitInfo ? !!limitInfo.unlimited : Number(myPlan?.max_accounts || 1) >= 999}
                planLabel={myPlan?.name || plan}
                onGoJournal={() => setView('operaciones')}
              />
            </>)}

            {view !== 'hub' && <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setView('hub')}>{L.back}</button>}

            {view === 'rendimiento' && (() => {
              const sWR = a.winRate >= 50 ? GREEN : a.winRate >= 40 ? GOLD : RED;
              const sPF = a.profitFactor >= 1.3 ? GREEN : a.profitFactor >= 1 ? GOLD : RED;
              const sPO = a.payoff >= 1.5 ? GREEN : a.payoff >= 1 ? GOLD : RED;
              const bePct = a.n ? Math.round(100 * a.catBE / a.n) : 0;
              return (<>
              <div className="grid g4">
                <StatCard icon="💰" label={L.kNet} value={money2(a.net)} accent={a.net >= 0 ? GREEN : RED} color={a.net >= 0 ? GREEN : RED} />
                <StatCard icon="🎯" label={L.kWR} value={`${a.winRate.toFixed(0)}%`} accent={sWR} color={sWR} bar={a.winRate / 100} />
                <StatCard icon="⚖️" label={L.kPF} value={a.profitFactor.toFixed(2)} accent={sPF} color={sPF} bar={Math.min(a.profitFactor, 3) / 3} />
                <StatCard icon="📐" label={L.kExp} value={money2(a.expectancy)} accent={a.expectancy >= 0 ? GREEN : RED} color={a.expectancy >= 0 ? GREEN : RED} />
              </div>
              <div className="grid g4">
                <StatCard icon="🟢" label={L.kAvgW} value={money(a.avgWin)} accent={GREEN} color={GREEN} />
                <StatCard icon="🔻" label={L.kAvgL} value={money(-a.avgLoss)} accent={RED} color={RED} />
                <StatCard icon="🔁" label={L.kPayoff} value={a.payoff.toFixed(2)} accent={sPO} color={sPO} bar={Math.min(a.payoff, 2) / 2} />
                <StatCard icon="⏱️" label={L.kDur} value={a.avgDurMin ? fmtDur(a.avgDurMin) : '—'} accent={BLUE} />
              </div>
              <div className="grid g4">
                <StatCard icon="📊" label={L.kOps} value={String(a.n)} accent={BLUE} />
                <StatCard icon="🏆" label={L.kBest} value={money(a.best)} accent={GREEN} color={GREEN} />
                <StatCard icon="💀" label={L.kWorst} value={money(a.worst)} accent={RED} color={RED} />
                <StatCard icon="⚪" label={L.kBE} value={`${a.catBE} · ${bePct}%`} accent={GOLD} color={GOLD} bar={bePct / 100} />
              </div>
              <div className="grid g2">
                <Card title={L.radarTitle} icon="🕸️"><RadarChart axes={radarAxes} color={BLUE} /></Card>
                <Card title={L.bubbleTitle} icon="🫧"><Bubbles items={bubbleData} /></Card>
              </div>
              <div className="grid g2">
                <Card title={L.equity} icon="📈">
                  {a.equity.length > 1 ? (<svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}><defs><linearGradient id="eq" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BLUE} stopOpacity="0.35" /><stop offset="100%" stopColor={BLUE} stopOpacity="0" /></linearGradient></defs><path d={`${path} L${W},${H} L0,${H} Z`} fill="url(#eq)" /><path d={path} fill="none" stroke={BLUE} strokeWidth="2.5" /></svg>) : <p className="muted">{L.notEnough}</p>}
                  <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 13, color: 'var(--mut)' }}><span>{L.ddMax} <b style={{ color: RED }}>{money(-a.maxDD)}</b></span><span>{L.streakMax} <b style={{ color: GREEN }}>{a.maxWin}W</b> / <b style={{ color: RED }}>{a.maxLoss}L</b></span></div>
                </Card>
                <Card title={L.donutTitle} icon="🍩"><Donut win={a.catWin} loss={a.catLoss} be={a.catBE} L={L} /></Card>
              </div>
              {/* Ganancias parciales: Full TP vs cierres parciales + motivo de salida */}
              <Card title={L.pExitTitle} icon="🎯">
                {a.hasReasons ? (
                  <>
                    <div className="grid g4" style={{ marginBottom: 12 }}>
                      <StatCard icon="🎯" label={L.pFullTP} value={`${a.fullTP}`} sub={a.n ? `${Math.round(100 * a.fullTP / a.n)}% · ${L.pFullTPsub}` : L.pFullTPsub} accent={GREEN} color={GREEN} bar={a.n ? a.fullTP / a.n : 0} />
                      <StatCard icon="✂️" label={L.pPartial} value={`${a.partialTrades}`} sub={a.n ? `${Math.round(100 * a.partialTrades / a.n)}% · ${L.pPartialSub}` : L.pPartialSub} accent={BLUE} color={BLUE} bar={a.n ? a.partialTrades / a.n : 0} />
                      <StatCard icon="💰" label={L.pPartialProfit} value={money(a.partialProfit)} sub={L.pPartialProfitSub} accent={a.partialProfit >= 0 ? GREEN : RED} color={a.partialProfit >= 0 ? GREEN : RED} />
                      <StatCard icon="🏃" label={L.pRunner} value={money(a.runnerProfit)} sub={L.pRunnerSub} accent={a.runnerProfit >= 0 ? GREEN : RED} color={a.runnerProfit >= 0 ? GREEN : RED} />
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{L.pReasons}</div>
                    {(() => {
                      const er = a.exitReasons as Record<string, number>;
                      const total = Object.values(er).reduce((s, v) => s + v, 0) || 1;
                      const rows: [string, number, string][] = [
                        [L.rTP, er.tp || 0, GREEN], [L.rTrailing, er.trailing || 0, BLUE],
                        [L.rManual, er.manual || 0, GOLD], [L.rSL, (er.sl || 0) + (er.so || 0), RED], [L.rOther, er.other || 0, 'var(--mut)'],
                      ];
                      return rows.filter((r) => r[1] > 0).map(([label, val, col], i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '5px 0' }}>
                          <span style={{ flex: '0 0 96px', fontSize: 12.5, color: 'var(--mut)' }}>{label}</span>
                          <div style={{ flex: 1, height: 10, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden' }}><div style={{ width: `${Math.round(100 * val / total)}%`, height: '100%', background: col }} /></div>
                          <span style={{ flex: '0 0 66px', textAlign: 'right', fontSize: 12, color: 'var(--mut)' }}>{val} · {Math.round(100 * val / total)}%</span>
                        </div>
                      ));
                    })()}
                  </>
                ) : <p className="muted" style={{ fontSize: 13, margin: 0 }}>{L.pNoData}</p>}
              </Card>
              <div className="grid g4">
                <StatCard icon="📅" label={L.bestDay} value={bWD ? WDL[lang][+bWD[0]] : '—'} accent={GREEN} color={GREEN} sub={bWD ? money(bWD[1].net) : ''} />
                <StatCard icon="⏰" label={L.bestHour} value={bH ? `${bH[0]}:00` : '—'} accent={GREEN} color={GREEN} sub={bH ? money(bH[1].net) : ''} />
                <StatCard icon="🌍" label={L.bestSess} value={bS ? sessName(bS[0]) : '—'} accent={GREEN} color={GREEN} sub={bS ? money(bS[1].net) : ''} />
                <StatCard icon="💱" label={L.bestPair} value={bSym ? bSym[0] : '—'} accent={GREEN} color={GREEN} sub={bSym ? money(bSym[1].net) : ''} />
              </div>
              <div className="grid g4">
                <StatCard icon="📅" label={L.worstDay} value={wWD ? WDL[lang][+wWD[0]] : '—'} accent={RED} color={RED} sub={wWD ? money(wWD[1].net) : ''} />
                <StatCard icon="⏰" label={L.worstHour} value={wH ? `${wH[0]}:00` : '—'} accent={RED} color={RED} sub={wH ? money(wH[1].net) : ''} />
                <StatCard icon="🌍" label={L.worstSess} value={wS ? sessName(wS[0]) : '—'} accent={RED} color={RED} sub={wS ? money(wS[1].net) : ''} />
                <StatCard icon="💱" label={L.worstPair} value={wSym ? wSym[0] : '—'} accent={RED} color={RED} sub={wSym ? money(wSym[1].net) : ''} />
              </div>
              <div className="grid g2">
                <Card title={L.lsTitle} icon="🔀"><BarRow label={L.longs} b={buy} max={maxLS} ops={L.ops} /><BarRow label={L.shorts} b={sell} max={maxLS} ops={L.ops} /></Card>
                <Card title={L.distTitle} icon="📊">{a.hist.length ? (<div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 130, marginTop: 6 }}>{a.hist.map((h, i) => (<div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}><div style={{ fontSize: 10, color: 'var(--mut)' }}>{h.count || ''}</div><div style={{ width: '100%', height: `${Math.max(3, (h.count / maxHist) * 96)}px`, background: h.pos ? 'linear-gradient(180deg,var(--green),var(--green2))' : 'linear-gradient(180deg,var(--red),var(--red2))', borderRadius: 4 }} /><div style={{ fontSize: 9, color: 'var(--mut)' }}>{h.label}</div></div>))}</div>) : <p className="muted">{L.noData}</p>}</Card>
              </div>
              <div className="grid g2">
                <Card title={L.topPairsT} icon="🏆">{top.length ? top.map(([sym, b], i) => <BarRow key={i} label={sym} b={b} max={maxTop} ops={L.ops} />) : <p className="muted">{L.noPos}</p>}</Card>
                <Card title={L.botPairsT} icon="💀">{bot.length ? bot.map(([sym, b], i) => <BarRow key={i} label={sym} b={b} max={maxTop} ops={L.ops} />) : <p className="muted">{L.noNeg}</p>}</Card>
              </div>
              <div className="grid g2">
                <Card title={L.byWeekday} icon="📆">{weekdayData.map((d, i) => <BarRow key={i} label={d.label} b={d.b} max={maxWD} ops={L.ops} />)}</Card>
                <Card title={L.bySession} icon="🌍">{sessData.map((d, i) => <BarRow key={i} label={d.label} b={d.b} max={maxS} ops={L.ops} />)}</Card>
              </div>
              <Card title={L.byHour} icon="⏰">{hourData.length ? hourData.map((d, i) => <BarRow key={i} label={d.label} b={d.b} max={maxH} ops={L.ops} />) : <p className="muted">{L.noData}</p>}</Card>
              <Card title={L.byMonth} icon="🗓️">{monthData.length ? monthData.map((d, i) => <BarRow key={i} label={d.label} b={d.b} max={maxM} ops={L.ops} />) : <p className="muted">{L.noData}</p>}</Card>
            </>); })()}

            {view === 'calendario' && (
              <Card title={L.calTitle} icon="🗓️" right={<div className="row"><button className={'btn ' + (vw === 'mes' ? 'btn-primary' : 'btn-ghost')} onClick={() => setVw('mes')}>{L.month}</button><button className={'btn ' + (vw === 'ano' ? 'btn-primary' : 'btn-ghost')} onClick={() => setVw('ano')}>{L.year}</button></div>}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div className="row"><button className="btn btn-ghost" onClick={prevM}>‹</button><b style={{ minWidth: 130, textAlign: 'center' }}>{MOL[lang][calM]} {calY}</b><button className="btn btn-ghost" onClick={nextM}>›</button></div>
                  <span style={{ fontSize: 14 }}>{L.monthTotal} <b className={monthTotal >= 0 ? 'pos' : 'neg'}>{money2(monthTotal)}</b> <span className="muted">({monthTrades} {L.ops})</span></span>
                </div>
                {vw === 'mes' ? (<>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
                    {DAYH[lang].map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 11, color: 'var(--mut)' }}>{d}</div>)}
                    {cells.map((d, i) => { if (d === null) return <div key={i} />; const b = a.daily[dayKey(d)]; const net = b?.net || 0; const inten = b ? Math.min(1, Math.abs(net) / maxDay) : 0; const glowC = net >= 0 ? '52,226,160' : '255,107,125'; const bg = !b ? 'var(--bg2)' : `rgba(${glowC},${.2 + inten * .6})`; const key = dayKey(d); const isSel = key === selDay; return (<div key={i} onClick={() => b && setSelDay(isSel ? null : key)} style={{ background: bg, border: isSel ? '2px solid ' + BLUE : '1px solid var(--line)', borderRadius: 12, minHeight: 56, padding: 7, cursor: b ? 'pointer' : 'default', transition: 'transform .12s, box-shadow .14s', boxShadow: b && inten > 0.28 ? `0 0 14px -3px rgba(${glowC},${0.55})` : 'none' }}><div style={{ fontSize: 11, color: b ? (net >= 0 ? '#04150d' : '#2a060c') : 'var(--mut)', fontWeight: b ? 600 : 400 }}>{d}</div>{b && <div style={{ fontSize: 12, fontWeight: 800, marginTop: 4, color: net >= 0 ? '#04150d' : '#2a060c' }}>{money2(net)}</div>}{b && <div style={{ fontSize: 10, color: net >= 0 ? '#04150d' : '#2a060c', opacity: .8 }}>{b.count} {L.ops}</div>}</div>); })}
                  </div>
                  {selDay && (<div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}><b>{L.dayOps} {selDay}</b><table className="jtbl" style={{ marginTop: 8 }}><tbody>{dayTrades.map((t, i) => (<tr key={i} className="jrow"><td style={{ fontWeight: 600 }}>{t.symbol}</td><td><span className={'jside ' + (t.side === 'buy' ? 'buy' : 'sell')}>{t.side}</span></td><td className="muted" style={{ textAlign: 'right' }}>{(+t.volume).toFixed(2)}</td><td className="muted">{new Date(t.close_time).toUTCString().slice(17, 22)}</td><td style={{ textAlign: 'right' }}><span className={'jchip ' + (+t.net_profit >= 0 ? 'pos' : 'neg')}>{money2(+t.net_profit)}</span></td></tr>))}</tbody></table></div>)}
                </>) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                    {MOL[lang].map((m, i) => { const key = `${calY}-${String(i + 1).padStart(2, '0')}`; const b = a.byMonth[key]; const net = b?.net || 0; const ac = b ? (net >= 0 ? GREEN : RED) : 'var(--line)'; return (<div key={i} className="statcard" style={{ ['--ac' as any]: ac, padding: 12 }}><div className="sc-lbl" style={{ marginTop: 0 }}>{m}</div><div className="sc-val" style={{ fontSize: 16, color: b ? (net >= 0 ? GREEN : RED) : 'var(--mut)' }}>{b ? money2(net) : '—'}</div>{b && <div className="sc-sub">{b.count} {L.ops} · {Math.round(100 * b.wins / b.count)}%</div>}</div>); })}
                  </div>
                )}
              </Card>
            )}

            {view === 'operaciones' && (!canJournal ? <ProLock L={L} plan={upJ.name} desc={L.dLock1} price={upJ.price} preview={<PreviewJournal />} /> : <Journal trades={filtered} lang={lang} />)}
            {view === 'costes' && <Costs trades={filtered} lang={lang} />}
            {view === 'reto' && <Challenge lang={lang} />}
            {view === 'plan' && <PlanHabits lang={lang} />}

            {view === 'cuentas' && (<>
              <Card title={L.accCard} icon="🗂️">
                <div className="grid g3" style={{ marginBottom: 14 }}>
                  <StatCard icon="💰" label={L.balTotal} value={'$' + totalBalance.toLocaleString()} accent={BLUE} />
                  <StatCard icon="🗂️" label={L.accounts} value={String(accounts.length)} accent={PURPLE} />
                  <StatCard icon="📊" label={L.opsTotal} value={String(ranged.length)} accent={CYAN} />
                </div>
                <table className="jtbl"><thead><tr><th>{L.th_acc}</th><th>{L.th_broker}</th><th style={{ textAlign: 'right' }}>{L.th_bal}</th><th style={{ textAlign: 'right' }}>{L.th_net}</th><th style={{ textAlign: 'right' }}>{L.th_win}</th><th></th></tr></thead>
                  <tbody>{accounts.map((x) => { const st = accStats(x.id); return (
                    <tr key={x.id}>
                      <td>{editing === x.id ? (<span style={{ display: 'flex', gap: 6 }}><input value={nick} onChange={(e) => setNick(e.target.value)} placeholder={L.nickPh} style={{ width: 140, marginTop: 0, padding: '6px 8px' }} /><button className="btn btn-primary" onClick={() => saveNick(x.id)}>✓</button><button className="btn btn-ghost" onClick={() => setEditing('')}>✕</button></span>) : (<span>{accName(x)} {typeMeta(x.acc_type) && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: typeMeta(x.acc_type)!.color + '22', color: typeMeta(x.acc_type)!.color }}>{lang === 'es' ? typeMeta(x.acc_type)!.es : typeMeta(x.acc_type)!.en}</span>} <span className="muted" style={{ fontSize: 12 }}>· {x.platform} · #{x.login}</span></span>)}</td>
                      <td className="muted">{x.broker}</td>
                      <td style={{ textAlign: 'right' }}>${Number(x.balance || 0).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}><span className={'jchip ' + (st.net >= 0 ? 'pos' : 'neg')}>{money(st.net)}</span></td>
                      <td style={{ textAlign: 'right' }} className="muted">{st.wr}%</td>
                      <td style={{ textAlign: 'right' }}>{editing !== x.id && <button className="btn btn-ghost" onClick={() => { setEditing(x.id); setNick(x.nickname || ''); }}>{L.nameBtn}</button>}</td>
                    </tr>); })}</tbody>
                </table>
              </Card>
              {accounts.length >= 2 && (!canCompare ? <ProLock L={L} plan={upC.name} desc={L.dLock2} price={upC.price} preview={<PreviewCompare />} /> : <CompareAccounts accounts={accounts} trades={ranged} lang={lang} />)}
              {sel !== 'all' && cur && !canFunding && <ProLock L={L} plan={upF.name} desc={L.dLock3} price={upF.price} preview={<PreviewFunding />} />}
              {sel !== 'all' && cur && canFunding && <FundCard acc={cur} net={a.net} maxDD={a.maxDD} L={L} onSave={(fields) => { const toNum = (v: any) => (v === '' || v == null ? null : Number(v)); setAccounts(accounts.map((x) => (x.id === cur.id ? { ...x, fund_target: toNum(fields.fund_target), fund_max_daily: toNum(fields.fund_max_daily), fund_max_total: toNum(fields.fund_max_total), fund_start: toNum(fields.fund_start) } : x))); }} />}
              {sel !== 'all' && cur && canFunding && <AccountExtras acc={cur} net={a.net} lang={lang} onSaved={(fields) => setAccounts(accounts.map((x) => (x.id === cur.id ? { ...x, acc_type: fields.acc_type || null, challenge_status: fields.challenge_status || null, challenge_cost: fields.challenge_cost === '' ? null : Number(fields.challenge_cost) } : x)))} />}
              {sel === 'all' && <p className="muted" style={{ fontSize: 13 }}>{lang === 'es' ? 'Elige una cuenta arriba para ver su fondeo, retiros y documentos.' : 'Pick an account above to see its funding, payouts and documents.'}</p>}
            </>)}
          </div>
        )}
          </div>
        </div>
      </div>
    </>
  );
}
