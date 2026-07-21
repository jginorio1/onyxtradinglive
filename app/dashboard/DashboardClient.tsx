'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { analyze, bestOf, worstOf, topPairs, fmtDur, type T, type Bucket } from '@/lib/analytics';
import Journal from './Journal';
import Costs from './Costs';
import AccountExtras from './AccountExtras';
import CompareAccounts from './CompareAccounts';
import { typeMeta } from '@/lib/accountMeta';
import { Ring, MiniArea, MiniDonut, MiniBars, MiniHeat, RadarChart, Bubbles, healthScore } from './Modern';

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
type View = 'hub' | 'rendimiento' | 'calendario' | 'operaciones' | 'costes' | 'cuentas';

function money(n: number, dec = 0) { return (n >= 0 ? '+$' : '-$') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: dec }); }
function money2(n: number) { return (n >= 0 ? '+$' : '-$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
const GREEN = '#34e2a0', RED = '#ff6b7d', BLUE = '#7c8cff', PURPLE = '#b98bff', GOLD = '#ffd45e', CYAN = '#3ad0ff';

const WDL = { es: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] };
const WDS = { es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
const MOL = { es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
const DAYH = { es: ['L', 'M', 'X', 'J', 'V', 'S', 'D'], en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'] };
const SESS: Record<string, { es: string; en: string }> = { 'Londres': { es: 'Londres', en: 'London' }, 'Nueva York': { es: 'Nueva York', en: 'New York' }, 'Asia': { es: 'Asia', en: 'Asia' } };

const D = {
  es: {
    nav_dash: 'Panel', nav_connect: 'Conectar cuenta', nav_plan: 'Plan', signout: 'Salir',
    analytics: 'Tu panel', accountsWord: 'cuenta(s)', balance: 'Balance', connectBtn: '+ Conectar cuenta',
    empty1_t: 'Conecta tu primera cuenta', empty1_d: 'Instala el Onyx Connector (MT4/MT5), genera una API key y en segundos verás aquí todas tus estadísticas.', empty1_cta: 'Conectar cuenta →',
    empty2: 'Cuenta conectada. En cuanto cierres operaciones, aparecerán aquí tus analíticas.',
    portfolio: 'Portafolio', updated: 'Actualizado hace', sAgo: 's', now: 'ahora mismo',
    insights: '💡 Onyx te dice', health: 'Salud de la cuenta', back: '← Volver al panel',
    secPerf: 'Rendimiento', secPerfSub: 'KPIs, equity, pares y horas', secCal: 'Calendario', secCalSub: 'P&L por día y mes',
    secOps: 'Operaciones', secOpsSub: 'Diario, filtros y lotaje', secCost: 'Costes', secCostSub: 'Comisión y swap', secAcc: 'Cuentas', secAccSub: 'Fondeo, retiros y comparar',
    kNet: 'Ganancia neta', kWR: 'Win rate', kPF: 'Profit factor', kExp: 'Expectancy', kAvgW: 'Ganancia media', kAvgL: 'Pérdida media', kPayoff: 'Payoff', kDur: 'Duración media', kOps: 'Operaciones', kBest: 'Mejor trade', kWorst: 'Peor trade', kBE: 'Break even',
    equity: 'Curva de equity', notEnough: 'Aún no hay suficientes operaciones.', ddMax: 'Drawdown máx:', streakMax: 'Racha máx:',
    donutTitle: 'Resultado de operaciones', dWin: 'Ganadoras', dLoss: 'Perdedoras', dBE: 'Break even', dCenter: 'ganadoras',
    calTitle: 'Calendario de resultados', month: 'Mes', year: 'Año', monthTotal: 'Total mes:', ops: 'ops', dayOps: 'Operaciones del',
    bestDay: 'Mejor día', bestHour: 'Mejor hora', bestSess: 'Mejor sesión', bestPair: 'Mejor par', worstDay: 'Peor día', worstHour: 'Peor hora', worstSess: 'Peor sesión', worstPair: 'Peor par',
    lsTitle: 'Largos vs Cortos', longs: '🟢 Largos', shorts: '🔴 Cortos', distTitle: 'Distribución de resultados', noData: 'Sin datos.',
    topPairsT: 'Top 5 mejores pares', botPairsT: 'Top 5 peores pares', noPos: 'Sin pares en positivo.', noNeg: 'Sin pares en negativo.',
    byWeekday: 'Por día de la semana', bySession: 'Por sesión', byHour: 'Por hora del día', byMonth: 'Por mes',
    accCard: 'Cuentas y portafolio', balTotal: 'Balance total', accounts: 'Cuentas', opsTotal: 'Operaciones', th_acc: 'Cuenta', th_broker: 'Bróker', th_bal: 'Balance', th_net: 'Neto', th_win: 'Win', nickPh: 'Ej: FTMO 50K', nameBtn: '✏️ Nombre',
    fundTitle: '🏆 Reglas de fondeo', fundEdit: '⚙️ Configurar reglas', fundHide: 'Ocultar', fundTarget: 'Objetivo de profit ($)', fundMaxDaily: 'Pérdida diaria máx ($)', fundMaxTotal: 'Pérdida total máx ($)', fundStart: 'Balance inicial ($)', fundSave: 'Guardar reglas', fundProfitBar: 'Progreso al objetivo', fundDDBar: 'Uso de pérdida máxima',
    ranges: { d1: 'Hoy', d7: '7d', d30: '30d', mo: 'Mes', yr: 'Año', all: 'Todo' },
    radarTitle: 'Perfil del trader', bubbleTitle: 'Pares · volumen y resultado', rWR: 'Win rate', rPF: 'P. factor', rPayoff: 'Payoff', rConsist: 'Consistencia', rRisk: 'Riesgo', demo: 'Demo', demoOn: '🎬 Viendo datos de ejemplo (no reales)',
  },
  en: {
    nav_dash: 'Dashboard', nav_connect: 'Connect account', nav_plan: 'Plan', signout: 'Sign out',
    analytics: 'Your dashboard', accountsWord: 'account(s)', balance: 'Balance', connectBtn: '+ Connect account',
    empty1_t: 'Connect your first account', empty1_d: 'Install the Onyx Connector (MT4/MT5), generate an API key and in seconds all your stats will show up here.', empty1_cta: 'Connect account →',
    empty2: 'Account connected. As soon as you close trades, your analytics will appear here.',
    portfolio: 'Portfolio', updated: 'Updated', sAgo: 's ago', now: 'just now',
    insights: '💡 Onyx says', health: 'Account health', back: '← Back to dashboard',
    secPerf: 'Performance', secPerfSub: 'KPIs, equity, pairs and hours', secCal: 'Calendar', secCalSub: 'P&L by day and month',
    secOps: 'Trades', secOpsSub: 'Journal, filters and lots', secCost: 'Costs', secCostSub: 'Commission and swap', secAcc: 'Accounts', secAccSub: 'Funding, payouts and compare',
    kNet: 'Net profit', kWR: 'Win rate', kPF: 'Profit factor', kExp: 'Expectancy', kAvgW: 'Avg win', kAvgL: 'Avg loss', kPayoff: 'Payoff', kDur: 'Avg duration', kOps: 'Trades', kBest: 'Best trade', kWorst: 'Worst trade', kBE: 'Break even',
    equity: 'Equity curve', notEnough: 'Not enough trades yet.', ddMax: 'Max drawdown:', streakMax: 'Max streak:',
    donutTitle: 'Trade outcome', dWin: 'Winners', dLoss: 'Losers', dBE: 'Break even', dCenter: 'winners',
    calTitle: 'Results calendar', month: 'Month', year: 'Year', monthTotal: 'Month total:', ops: 'trades', dayOps: 'Trades on',
    bestDay: 'Best day', bestHour: 'Best hour', bestSess: 'Best session', bestPair: 'Best pair', worstDay: 'Worst day', worstHour: 'Worst hour', worstSess: 'Worst session', worstPair: 'Worst pair',
    lsTitle: 'Longs vs Shorts', longs: '🟢 Longs', shorts: '🔴 Shorts', distTitle: 'Results distribution', noData: 'No data.',
    topPairsT: 'Top 5 best pairs', botPairsT: 'Top 5 worst pairs', noPos: 'No pairs in profit.', noNeg: 'No pairs in loss.',
    byWeekday: 'By weekday', bySession: 'By session', byHour: 'By hour of day', byMonth: 'By month',
    accCard: 'Accounts & portfolio', balTotal: 'Total balance', accounts: 'Accounts', opsTotal: 'Trades', th_acc: 'Account', th_broker: 'Broker', th_bal: 'Balance', th_net: 'Net', th_win: 'Win', nickPh: 'e.g. FTMO 50K', nameBtn: '✏️ Name',
    fundTitle: '🏆 Prop-firm rules', fundEdit: '⚙️ Set rules', fundHide: 'Hide', fundTarget: 'Profit target ($)', fundMaxDaily: 'Max daily loss ($)', fundMaxTotal: 'Max total loss ($)', fundStart: 'Starting balance ($)', fundSave: 'Save rules', fundProfitBar: 'Progress to target', fundDDBar: 'Max loss used',
    ranges: { d1: 'Today', d7: '7d', d30: '30d', mo: 'Month', yr: 'Year', all: 'All' },
    radarTitle: 'Trader profile', bubbleTitle: 'Pairs · volume and result', rWR: 'Win rate', rPF: 'P. factor', rPayoff: 'Payoff', rConsist: 'Consistency', rRisk: 'Risk', demo: 'Demo', demoOn: '🎬 Viewing example data (not real)',
  },
} as const;

function BarRow({ label, b, max, ops }: { label: string; b: Bucket; max: number; ops: string }) {
  const pct = max > 0 ? Math.abs(b.net) / max : 0;
  const grad = b.net >= 0 ? 'linear-gradient(90deg,#12b981,#34e2a0)' : 'linear-gradient(90deg,#e23b55,#ff6b7d)';
  const wr = b.count ? Math.round(100 * b.wins / b.count) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '7px 0' }}>
      <div style={{ width: 74, fontSize: 13, color: 'var(--mut)' }}>{label}</div>
      <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 6, height: 22, position: 'relative', overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(4, pct * 100)}%`, height: '100%', background: grad, borderRadius: 6 }} />
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
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{icon} {title}</h3>{right}
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
        <div style={{ height: 10, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden', marginBottom: 14 }}><div style={{ width: tp + '%', height: '100%', background: '#34e2a0' }} /></div>
        <div className="row between" style={{ fontSize: 13, marginBottom: 4 }}><span className="muted">{L.fundDDBar}</span><span style={{ fontWeight: 700 }}>{Math.round(dd)}%</span></div>
        <div style={{ height: 10, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden' }}><div style={{ width: dd + '%', height: '100%', background: dd > 70 ? '#ff6b7d' : '#ffcf5c' }} /></div>
      </>)}
      {edit && (<div style={{ marginTop: hasRules ? 16 : 0 }}>
        <div className="grid g2">
          <div><span style={lbl}>{L.fundTarget}</span><input type="number" value={f.fund_target} onChange={(e) => set('fund_target', e.target.value)} style={{ margin: 0 }} /></div>
          <div><span style={lbl}>{L.fundMaxTotal}</span><input type="number" value={f.fund_max_total} onChange={(e) => set('fund_max_total', e.target.value)} style={{ margin: 0 }} /></div>
          <div><span style={lbl}>{L.fundMaxDaily}</span><input type="number" value={f.fund_max_daily} onChange={(e) => set('fund_max_daily', e.target.value)} style={{ margin: 0 }} /></div>
          <div><span style={lbl}>{L.fundStart}</span><input type="number" value={f.fund_start} onChange={(e) => set('fund_start', e.target.value)} style={{ margin: 0 }} /></div>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={save} disabled={saving}>{saving ? '...' : L.fundSave}</button>
      </div>)}
    </div>
  );
}

export default function DashboardClient({ email = '', plan = 'free', trades = [], accounts: accs0 = [] }: { email?: string; plan?: string; trades?: TT[]; accounts?: Acc[] }) {
  const [lang, setLang] = useState<Lang>('es');
  const [accounts, setAccounts] = useState<Acc[]>(accs0 || []);
  const [tradesS, setTradesS] = useState<TT[]>(trades || []);
  const [sel, setSel] = useState<string>('all');
  const [view, setView] = useState<View>('hub');
  const [range, setRange] = useState<keyof typeof D['es']['ranges']>('all');
  const [demo, setDemo] = useState(false);
  const demoTrades = useMemo(() => genDemo(accs0[0]?.id || 'demo'), []);
  const [editing, setEditing] = useState<string>('');
  const [nick, setNick] = useState('');
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [, setTick] = useState(0);
  const L = D[lang];

  useEffect(() => {
    try { const s = localStorage.getItem('onyx_lang'); if (s === 'en' || s === 'es') setLang(s as Lang); else if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en')) setLang('en'); } catch {}
  }, []);
  function switchLang(l: Lang) { setLang(l); try { localStorage.setItem('onyx_lang', l); } catch {} }

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
    return src.filter((x) => {
      const dt = new Date(x.close_time); const d = dt.getTime();
      if (range === 'd1') return d >= now - 864e5;
      if (range === 'd7') return d >= now - 7 * 864e5;
      if (range === 'd30') return d >= now - 30 * 864e5;
      if (range === 'mo') { const n = new Date(); return dt.getUTCFullYear() === n.getUTCFullYear() && dt.getUTCMonth() === n.getUTCMonth(); }
      if (range === 'yr') return dt.getUTCFullYear() === new Date().getUTCFullYear();
      return true;
    });
  }, [tradesS, demo, demoTrades, range]);

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

  const SECTIONS: { key: View; icon: string; label: string; sub: string; color: string; metric: string; mc: string; viz: any }[] = [
    { key: 'rendimiento', icon: '🎯', label: L.secPerf, sub: L.secPerfSub, color: BLUE, metric: money2(a.net), mc: a.net >= 0 ? GREEN : RED, viz: <div style={{ width: 110 }}><MiniArea points={eqVals.length > 1 ? eqVals : [0, 0]} color={a.net >= 0 ? GREEN : RED} h={44} /></div> },
    { key: 'calendario', icon: '🗓️', label: L.secCal, sub: L.secCalSub, color: GREEN, metric: `${a.n} ${L.ops}`, mc: '#f2f5fb', viz: <div style={{ width: 110 }}><MiniHeat cells={heatCells} /></div> },
    { key: 'operaciones', icon: '📋', label: L.secOps, sub: L.secOpsSub, color: PURPLE, metric: String(a.n), mc: '#f2f5fb', viz: <MiniDonut size={46} segs={[{ v: a.catWin, c: GREEN }, { v: a.catLoss, c: RED }, { v: a.catBE, c: GOLD }]} /> },
    { key: 'costes', icon: '💸', label: L.secCost, sub: L.secCostSub, color: GOLD, metric: money2(costAll), mc: costAll >= 0 ? GREEN : RED, viz: <Ring size={46} pct={eaten / 100} color={GOLD} value={eaten + '%'} /> },
    { key: 'cuentas', icon: '🗂️', label: L.secAcc, sub: L.secAccSub, color: CYAN, metric: String(accounts.length), mc: '#f2f5fb', viz: <div style={{ width: 100 }}><MiniBars vals={accounts.length ? accounts.map((x) => accStats(x.id).net) : [1, 1]} colors={accounts.length ? accounts.map((x) => (accStats(x.id).net >= 0 ? GREEN : RED)) : [BLUE]} h={44} /></div> },
  ];

  const kpi = (lbl: string, val: string, cls = '') => <div className="card kpi"><div className="lbl">{lbl}</div><div className={'val ' + cls}>{val}</div></div>;

  return (
    <>
      <div className="topbar"><div className="wrap">
        <div className="logo"><span className="mark">◆</span> Onyx</div>
        <div className="navl"><Link href="/dashboard">{L.nav_dash}</Link><Link href="/dashboard/keys">{L.nav_connect}</Link><Link href="/pricing">{L.nav_plan}</Link></div>
        <div className="row">
          <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => switchLang(lang === 'es' ? 'en' : 'es')}>{lang === 'es' ? '🇬🇧 EN' : '🇪🇸 ES'}</button>
          <span className="pill green">{plan}</span>
          <form action="/auth/signout" method="post"><button className="btn btn-ghost">{L.signout}</button></form>
        </div>
      </div></div>

      <div className="wrap" style={{ padding: '24px 22px' }}>
        <div className="row between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ marginBottom: 2 }}>📊 {L.analytics}</h1>
            <p className="muted" style={{ fontSize: 13 }}>{email} · {accounts.length} {L.accountsWord} · {L.balance} ${totalBalance.toLocaleString()} · <span style={{ color: GREEN }}>● {updatedTxt}</span></p>
          </div>
          <Link className="btn btn-ghost" href="/dashboard/keys">{L.connectBtn}</Link>
        </div>

        {!hasAccounts ? (
          <div className="card"><h3>{L.empty1_t}</h3><p className="muted" style={{ margin: '8px 0 14px' }}>{L.empty1_d}</p><Link className="btn btn-primary" href="/dashboard/keys">{L.empty1_cta}</Link></div>
        ) : !hasTrades ? (
          <div className="card"><p className="muted">{L.empty2}</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* controles: cuentas + filtro de tiempo */}
            <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className={'btn ' + (sel === 'all' ? 'btn-primary' : 'btn-ghost')} onClick={() => setSel('all')}>📊 {L.portfolio}</button>
                {accounts.map((x) => <button key={x.id} className={'btn ' + (sel === x.id ? 'btn-primary' : 'btn-ghost')} onClick={() => setSel(x.id)}>{accName(x)}</button>)}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['d1', 'd7', 'd30', 'mo', 'yr', 'all'] as const).map((r) => <button key={r} className={'btn ' + (range === r ? 'btn-primary' : 'btn-ghost')} style={{ padding: '7px 12px' }} onClick={() => setRange(r)}>{L.ranges[r]}</button>)}
                <button className={'btn ' + (demo ? 'btn-primary' : 'btn-ghost')} style={{ padding: '7px 12px' }} onClick={() => setDemo(!demo)}>🎬 {L.demo}</button>
              </div>
            </div>
            {demo && <div style={{ background: 'rgba(255,192,77,.12)', border: '1px solid var(--amber)', color: 'var(--amber)', borderRadius: 10, padding: '8px 14px', fontSize: 13, alignSelf: 'flex-start' }}>{L.demoOn}</div>}

            {view === 'hub' && (<>
              {/* Onyx te dice */}
              {insights.length > 0 && (
                <div className="card">
                  <h3 style={{ marginBottom: 12 }}>{L.insights}</h3>
                  <div className="grid g2">
                    {insights.map((x, i) => <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px' }}><span style={{ fontSize: 20 }}>{x.icon}</span><span style={{ fontSize: 14 }}>{x.txt}</span></div>)}
                  </div>
                </div>
              )}

              {/* Hero: health + anillos */}
              <div className="grid g4">
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, border: '1px solid ' + hs.color + '55' }}>
                  <Ring pct={hs.score / 100} color={hs.color} value={String(hs.score)} />
                  <div><div className="muted" style={{ fontSize: 13 }}>{L.health}</div><div style={{ fontSize: 15, fontWeight: 700, color: hs.color }}>/ 100</div></div>
                </div>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}><Ring pct={a.winRate / 100} color={GREEN} value={`${Math.round(a.winRate)}%`} /><div className="muted" style={{ fontSize: 13 }}>{L.kWR}</div></div>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}><Ring pct={Math.min(a.profitFactor, 3) / 3} color={PURPLE} value={a.profitFactor.toFixed(2)} /><div className="muted" style={{ fontSize: 13 }}>{L.kPF}</div></div>
                <div className="card kpi"><div className="lbl">{L.kNet}</div><div className={'val ' + (a.net >= 0 ? 'pos' : 'neg')}>{money2(a.net)}</div><MiniArea points={eqVals.length > 1 ? eqVals : [0, 0]} color={a.net >= 0 ? GREEN : RED} h={34} /></div>
              </div>

              {/* Botones grandes */}
              <div className="grid g3">
                {SECTIONS.map((s) => (
                  <button key={s.key} onClick={() => setView(s.key)} className="card" style={{ cursor: 'pointer', textAlign: 'left', borderTop: '3px solid ' + s.color }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <span style={{ width: 38, height: 38, borderRadius: 11, background: s.color + '22', color: s.color, display: 'grid', placeItems: 'center', fontSize: 20 }}>{s.icon}</span>
                      <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 17, color: '#fff' }}>{s.label}</div><div className="muted" style={{ fontSize: 12 }}>{s.sub}</div></div>
                      <span style={{ color: 'var(--mut)', fontSize: 18 }}>→</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ fontSize: 19, fontWeight: 800, color: s.mc, whiteSpace: 'nowrap' }}>{s.metric}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{s.viz}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>)}

            {view !== 'hub' && <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setView('hub')}>{L.back}</button>}

            {view === 'rendimiento' && (<>
              <div className="grid g4">{kpi(L.kNet, money2(a.net), a.net >= 0 ? 'pos' : 'neg')}{kpi(L.kWR, `${a.winRate.toFixed(0)}%`)}{kpi(L.kPF, a.profitFactor.toFixed(2))}{kpi(L.kExp, money2(a.expectancy), a.expectancy >= 0 ? 'pos' : 'neg')}</div>
              <div className="grid g4">{kpi(L.kAvgW, money(a.avgWin), 'pos')}{kpi(L.kAvgL, money(-a.avgLoss), 'neg')}{kpi(L.kPayoff, a.payoff.toFixed(2))}<div className="card kpi"><div className="lbl">{L.kDur}</div><div className="val" style={{ fontSize: 20 }}>{a.avgDurMin ? fmtDur(a.avgDurMin) : '—'}</div></div></div>
              <div className="grid g4">{kpi(L.kOps, String(a.n))}{kpi(L.kBest, money(a.best), 'pos')}{kpi(L.kWorst, money(a.worst), 'neg')}<div className="card kpi"><div className="lbl">{L.kBE}</div><div className="val" style={{ color: GOLD }}>{a.catBE} · {a.n ? Math.round(100 * a.catBE / a.n) : 0}%</div></div></div>
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
              <div className="grid g4">
                <div className="card kpi" style={{ borderLeft: '3px solid ' + GREEN }}><div className="lbl">📅 {L.bestDay}</div><div className="val pos" style={{ fontSize: 18 }}>{bWD ? WDL[lang][+bWD[0]] : '—'}</div><div className="muted" style={{ fontSize: 12 }}>{bWD ? money(bWD[1].net) : ''}</div></div>
                <div className="card kpi" style={{ borderLeft: '3px solid ' + GREEN }}><div className="lbl">⏰ {L.bestHour}</div><div className="val pos" style={{ fontSize: 18 }}>{bH ? `${bH[0]}:00` : '—'}</div><div className="muted" style={{ fontSize: 12 }}>{bH ? money(bH[1].net) : ''}</div></div>
                <div className="card kpi" style={{ borderLeft: '3px solid ' + GREEN }}><div className="lbl">🌍 {L.bestSess}</div><div className="val pos" style={{ fontSize: 18 }}>{bS ? sessName(bS[0]) : '—'}</div><div className="muted" style={{ fontSize: 12 }}>{bS ? money(bS[1].net) : ''}</div></div>
                <div className="card kpi" style={{ borderLeft: '3px solid ' + GREEN }}><div className="lbl">💱 {L.bestPair}</div><div className="val pos" style={{ fontSize: 18 }}>{bSym ? bSym[0] : '—'}</div><div className="muted" style={{ fontSize: 12 }}>{bSym ? money(bSym[1].net) : ''}</div></div>
              </div>
              <div className="grid g4">
                <div className="card kpi" style={{ borderLeft: '3px solid ' + RED }}><div className="lbl">📅 {L.worstDay}</div><div className="val neg" style={{ fontSize: 18 }}>{wWD ? WDL[lang][+wWD[0]] : '—'}</div><div className="muted" style={{ fontSize: 12 }}>{wWD ? money(wWD[1].net) : ''}</div></div>
                <div className="card kpi" style={{ borderLeft: '3px solid ' + RED }}><div className="lbl">⏰ {L.worstHour}</div><div className="val neg" style={{ fontSize: 18 }}>{wH ? `${wH[0]}:00` : '—'}</div><div className="muted" style={{ fontSize: 12 }}>{wH ? money(wH[1].net) : ''}</div></div>
                <div className="card kpi" style={{ borderLeft: '3px solid ' + RED }}><div className="lbl">🌍 {L.worstSess}</div><div className="val neg" style={{ fontSize: 18 }}>{wS ? sessName(wS[0]) : '—'}</div><div className="muted" style={{ fontSize: 12 }}>{wS ? money(wS[1].net) : ''}</div></div>
                <div className="card kpi" style={{ borderLeft: '3px solid ' + RED }}><div className="lbl">💱 {L.worstPair}</div><div className="val neg" style={{ fontSize: 18 }}>{wSym ? wSym[0] : '—'}</div><div className="muted" style={{ fontSize: 12 }}>{wSym ? money(wSym[1].net) : ''}</div></div>
              </div>
              <div className="grid g2">
                <Card title={L.lsTitle} icon="🔀"><BarRow label={L.longs} b={buy} max={maxLS} ops={L.ops} /><BarRow label={L.shorts} b={sell} max={maxLS} ops={L.ops} /></Card>
                <Card title={L.distTitle} icon="📊">{a.hist.length ? (<div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 130, marginTop: 6 }}>{a.hist.map((h, i) => (<div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}><div style={{ fontSize: 10, color: 'var(--mut)' }}>{h.count || ''}</div><div style={{ width: '100%', height: `${Math.max(3, (h.count / maxHist) * 96)}px`, background: h.pos ? 'linear-gradient(180deg,#34e2a0,#12b981)' : 'linear-gradient(180deg,#ff6b7d,#e23b55)', borderRadius: 4 }} /><div style={{ fontSize: 9, color: 'var(--mut)' }}>{h.label}</div></div>))}</div>) : <p className="muted">{L.noData}</p>}</Card>
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
            </>)}

            {view === 'calendario' && (
              <Card title={L.calTitle} icon="🗓️" right={<div className="row"><button className={'btn ' + (vw === 'mes' ? 'btn-primary' : 'btn-ghost')} onClick={() => setVw('mes')}>{L.month}</button><button className={'btn ' + (vw === 'ano' ? 'btn-primary' : 'btn-ghost')} onClick={() => setVw('ano')}>{L.year}</button></div>}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div className="row"><button className="btn btn-ghost" onClick={prevM}>‹</button><b style={{ minWidth: 130, textAlign: 'center' }}>{MOL[lang][calM]} {calY}</b><button className="btn btn-ghost" onClick={nextM}>›</button></div>
                  <span style={{ fontSize: 14 }}>{L.monthTotal} <b className={monthTotal >= 0 ? 'pos' : 'neg'}>{money2(monthTotal)}</b> <span className="muted">({monthTrades} {L.ops})</span></span>
                </div>
                {vw === 'mes' ? (<>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
                    {DAYH[lang].map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 11, color: 'var(--mut)' }}>{d}</div>)}
                    {cells.map((d, i) => { if (d === null) return <div key={i} />; const b = a.daily[dayKey(d)]; const net = b?.net || 0; const inten = b ? Math.min(1, Math.abs(net) / maxDay) : 0; const bg = !b ? 'var(--bg2)' : net >= 0 ? `rgba(52,226,160,${.2 + inten * .6})` : `rgba(255,107,125,${.2 + inten * .6})`; const key = dayKey(d); return (<div key={i} onClick={() => b && setSelDay(key === selDay ? null : key)} style={{ background: bg, border: key === selDay ? '2px solid ' + BLUE : '1px solid var(--line)', borderRadius: 8, minHeight: 54, padding: 6, cursor: b ? 'pointer' : 'default' }}><div style={{ fontSize: 11, color: 'var(--mut)' }}>{d}</div>{b && <div style={{ fontSize: 12, fontWeight: 800, marginTop: 4, color: net >= 0 ? '#04150d' : '#1a0509' }}>{money(net)}</div>}{b && <div style={{ fontSize: 10, color: net >= 0 ? '#04150d' : '#1a0509', opacity: .75 }}>{b.count} {L.ops}</div>}</div>); })}
                  </div>
                  {selDay && (<div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}><b>{L.dayOps} {selDay}</b><table style={{ marginTop: 8 }}><tbody>{dayTrades.map((t, i) => (<tr key={i}><td>{t.symbol}</td><td className="muted">{t.side}</td><td className="muted" style={{ textAlign: 'right' }}>{(+t.volume).toFixed(2)}</td><td className="muted">{new Date(t.close_time).toUTCString().slice(17, 22)}</td><td style={{ textAlign: 'right' }} className={+t.net_profit >= 0 ? 'pos' : 'neg'}>{money2(+t.net_profit)}</td></tr>))}</tbody></table></div>)}
                </>) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                    {MOL[lang].map((m, i) => { const key = `${calY}-${String(i + 1).padStart(2, '0')}`; const b = a.byMonth[key]; const net = b?.net || 0; return (<div key={i} style={{ background: 'var(--bg2)', borderRadius: 10, padding: 12, borderLeft: '3px solid ' + (b ? (net >= 0 ? GREEN : RED) : 'var(--line)') }}><div className="muted" style={{ fontSize: 12 }}>{m}</div><div style={{ fontWeight: 800, fontSize: 15, color: b ? (net >= 0 ? GREEN : RED) : 'var(--mut)' }}>{b ? money2(net) : '—'}</div>{b && <div className="muted" style={{ fontSize: 11 }}>{b.count} {L.ops} · {Math.round(100 * b.wins / b.count)}%</div>}</div>); })}
                  </div>
                )}
              </Card>
            )}

            {view === 'operaciones' && <Journal trades={filtered} lang={lang} />}
            {view === 'costes' && <Costs trades={filtered} lang={lang} />}

            {view === 'cuentas' && (<>
              <Card title={L.accCard} icon="🗂️">
                <div className="grid g3" style={{ marginBottom: 14 }}>
                  <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14, borderLeft: '3px solid ' + BLUE }}><div className="muted" style={{ fontSize: 12 }}>{L.balTotal}</div><div style={{ fontSize: 24, fontWeight: 800 }}>${totalBalance.toLocaleString()}</div></div>
                  <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14, borderLeft: '3px solid ' + PURPLE }}><div className="muted" style={{ fontSize: 12 }}>{L.accounts}</div><div style={{ fontSize: 24, fontWeight: 800 }}>{accounts.length}</div></div>
                  <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14, borderLeft: '3px solid ' + CYAN }}><div className="muted" style={{ fontSize: 12 }}>{L.opsTotal}</div><div style={{ fontSize: 24, fontWeight: 800 }}>{ranged.length}</div></div>
                </div>
                <table><thead><tr><th>{L.th_acc}</th><th>{L.th_broker}</th><th style={{ textAlign: 'right' }}>{L.th_bal}</th><th style={{ textAlign: 'right' }}>{L.th_net}</th><th style={{ textAlign: 'right' }}>{L.th_win}</th><th></th></tr></thead>
                  <tbody>{accounts.map((x) => { const st = accStats(x.id); return (
                    <tr key={x.id}>
                      <td>{editing === x.id ? (<span style={{ display: 'flex', gap: 6 }}><input value={nick} onChange={(e) => setNick(e.target.value)} placeholder={L.nickPh} style={{ width: 140, marginTop: 0, padding: '6px 8px' }} /><button className="btn btn-primary" onClick={() => saveNick(x.id)}>✓</button><button className="btn btn-ghost" onClick={() => setEditing('')}>✕</button></span>) : (<span>{accName(x)} {typeMeta(x.acc_type) && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: typeMeta(x.acc_type)!.color + '22', color: typeMeta(x.acc_type)!.color }}>{lang === 'es' ? typeMeta(x.acc_type)!.es : typeMeta(x.acc_type)!.en}</span>} <span className="muted" style={{ fontSize: 12 }}>· {x.platform} · #{x.login}</span></span>)}</td>
                      <td className="muted">{x.broker}</td>
                      <td style={{ textAlign: 'right' }}>${Number(x.balance || 0).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }} className={st.net >= 0 ? 'pos' : 'neg'}>{money(st.net)}</td>
                      <td style={{ textAlign: 'right' }} className="muted">{st.wr}%</td>
                      <td style={{ textAlign: 'right' }}>{editing !== x.id && <button className="btn btn-ghost" onClick={() => { setEditing(x.id); setNick(x.nickname || ''); }}>{L.nameBtn}</button>}</td>
                    </tr>); })}</tbody>
                </table>
              </Card>
              {accounts.length >= 2 && <CompareAccounts accounts={accounts} trades={ranged} lang={lang} />}
              {sel !== 'all' && cur && <FundCard acc={cur} net={a.net} maxDD={a.maxDD} L={L} onSave={(fields) => { const toNum = (v: any) => (v === '' || v == null ? null : Number(v)); setAccounts(accounts.map((x) => (x.id === cur.id ? { ...x, fund_target: toNum(fields.fund_target), fund_max_daily: toNum(fields.fund_max_daily), fund_max_total: toNum(fields.fund_max_total), fund_start: toNum(fields.fund_start) } : x))); }} />}
              {sel !== 'all' && cur && <AccountExtras acc={cur} net={a.net} lang={lang} onSaved={(fields) => setAccounts(accounts.map((x) => (x.id === cur.id ? { ...x, acc_type: fields.acc_type || null, challenge_status: fields.challenge_status || null, challenge_cost: fields.challenge_cost === '' ? null : Number(fields.challenge_cost) } : x)))} />}
              {sel === 'all' && <p className="muted" style={{ fontSize: 13 }}>{lang === 'es' ? 'Elige una cuenta arriba para ver su fondeo, retiros y documentos.' : 'Pick an account above to see its funding, payouts and documents.'}</p>}
            </>)}
          </div>
        )}
      </div>
    </>
  );
}
