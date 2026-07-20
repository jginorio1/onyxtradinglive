'use client';
import { useMemo, useState } from 'react';
import { analyze, bestOf, worstOf, topPairs, fmtDur, WD, WD_SHORT, MO, type T, type Bucket } from '@/lib/analytics';

type TT = T & { account_id: string };
type Acc = { id: string; login: number; nickname: string | null; broker: string; platform: string; balance: number; currency: string };

function money(n: number, dec = 0) {
  const s = Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: dec });
  return (n >= 0 ? '+$' : '-$') + s;
}
const GREEN = '#34e2a0', RED = '#ff6b7d', BLUE = '#7c8cff', PURPLE = '#b98bff', GOLD = '#ffd45e', CYAN = '#3ad0ff';

function BarRow({ label, b, max }: { label: string; b: Bucket; max: number }) {
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
      <div style={{ width: 78, fontSize: 12, color: 'var(--mut)', textAlign: 'right' }}>{b.count} ops · {wr}%</div>
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
function Donut({ win, loss, be }: { win: number; loss: number; be: number }) {
  const total = win + loss + be || 1;
  const R = 54, C = 2 * Math.PI * R; let acc = 0;
  const segs = [{ v: win, c: GREEN, l: 'Ganadoras' }, { v: loss, c: RED, l: 'Perdedoras' }, { v: be, c: GOLD, l: 'Break even' }];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={150} height={150} viewBox="0 0 150 150">
        <g transform="rotate(-90 75 75)">
          <circle cx={75} cy={75} r={R} fill="none" stroke="var(--bg2)" strokeWidth={16} />
          {segs.map((s, i) => { const frac = s.v / total; const dash = frac * C; const el = <circle key={i} cx={75} cy={75} r={R} fill="none" stroke={s.c} strokeWidth={16} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc * C} strokeLinecap="butt" />; acc += frac; return el; })}
        </g>
        <text x={75} y={72} textAnchor="middle" fill="#fff" fontSize={26} fontWeight={800}>{Math.round(100 * win / total)}%</text>
        <text x={75} y={92} textAnchor="middle" fill="var(--mut)" fontSize={11}>ganadoras</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {segs.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: s.c }} />
            <span style={{ color: 'var(--mut)', width: 96 }}>{s.l}</span>
            <b>{s.v}</b><span className="muted">({Math.round(100 * s.v / total)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardClient({ trades = [], accounts: accs0 = [] }: { trades?: TT[]; accounts?: Acc[] }) {
  const [accounts, setAccounts] = useState<Acc[]>(accs0 || []);
  const [sel, setSel] = useState<string>('all');
  const [editing, setEditing] = useState<string>('');
  const [nick, setNick] = useState('');

  const filtered = useMemo(() => (sel === 'all' ? trades : trades.filter((t) => t.account_id === sel)), [trades, sel]);
  const a = useMemo(() => analyze(filtered), [filtered]);

  const totalBalance = accounts.reduce((s, x) => s + Number(x.balance || 0), 0);
  const accName = (x: Acc) => x.nickname || `#${x.login}`;
  function accStats(id: string) { const ts = trades.filter((t) => t.account_id === id); let net = 0, w = 0; for (const t of ts) { const p = +t.net_profit || 0; net += p; if (p >= 0) w++; } return { net, ops: ts.length, wr: ts.length ? Math.round(100 * w / ts.length) : 0 }; }
  async function saveNick(id: string) { await fetch('/api/accounts', { method: 'PATCH', body: JSON.stringify({ id, nickname: nick }) }); setAccounts(accounts.map((x) => (x.id === id ? { ...x, nickname: nick } : x))); setEditing(''); }

  const weekOrder = [1, 2, 3, 4, 5, 6, 0];
  const weekdayData = weekOrder.map((i) => ({ label: WD_SHORT[i], b: a.byWeekday[String(i)] || { net: 0, count: 0, wins: 0 } }));
  const maxWD = Math.max(1, ...weekdayData.map((d) => Math.abs(d.b.net)));
  const hourData = Array.from({ length: 24 }, (_, h) => ({ label: `${h}h`, b: a.byHour[String(h)] || { net: 0, count: 0, wins: 0 } })).filter((d) => d.b.count > 0);
  const maxH = Math.max(1, ...hourData.map((d) => Math.abs(d.b.net)));
  const sessData = ['Londres', 'Nueva York', 'Asia'].map((s) => ({ label: s, b: a.bySession[s] || { net: 0, count: 0, wins: 0 } }));
  const maxS = Math.max(1, ...sessData.map((d) => Math.abs(d.b.net)));
  const monthData = Object.keys(a.byMonth).sort().map((key) => { const [y, m] = key.split('-'); return { label: `${MO[+m - 1]} ${y.slice(2)}`, b: a.byMonth[key] }; });
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
  const curName = sel === 'all' ? 'Portafolio completo' : (cur ? accName(cur) : '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Cuentas y portafolio */}
      <Card title="Cuentas y portafolio" icon="🗂️">
        <div className="grid g3" style={{ marginBottom: 14 }}>
          <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14, borderLeft: '3px solid ' + BLUE }}><div className="muted" style={{ fontSize: 12 }}>Balance total</div><div style={{ fontSize: 24, fontWeight: 800 }}>${totalBalance.toLocaleString()}</div></div>
          <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14, borderLeft: '3px solid ' + PURPLE }}><div className="muted" style={{ fontSize: 12 }}>Cuentas</div><div style={{ fontSize: 24, fontWeight: 800 }}>{accounts.length}</div></div>
          <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14, borderLeft: '3px solid ' + CYAN }}><div className="muted" style={{ fontSize: 12 }}>Operaciones totales</div><div style={{ fontSize: 24, fontWeight: 800 }}>{trades.length}</div></div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <button className={'btn ' + (sel === 'all' ? 'btn-primary' : 'btn-ghost')} onClick={() => setSel('all')}>📊 Portafolio</button>
          {accounts.map((x) => <button key={x.id} className={'btn ' + (sel === x.id ? 'btn-primary' : 'btn-ghost')} onClick={() => setSel(x.id)}>{accName(x)}</button>)}
        </div>
        <table><thead><tr><th>Cuenta</th><th>Bróker</th><th style={{ textAlign: 'right' }}>Balance</th><th style={{ textAlign: 'right' }}>Neto</th><th style={{ textAlign: 'right' }}>Win</th><th></th></tr></thead>
          <tbody>{accounts.map((x) => { const st = accStats(x.id); return (
            <tr key={x.id}>
              <td>{editing === x.id ? (<span style={{ display: 'flex', gap: 6 }}><input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Ej: FTMO 50K" style={{ width: 140, marginTop: 0, padding: '6px 8px' }} /><button className="btn btn-primary" onClick={() => saveNick(x.id)}>✓</button><button className="btn btn-ghost" onClick={() => setEditing('')}>✕</button></span>) : (<span>{accName(x)} <span className="muted" style={{ fontSize: 12 }}>· {x.platform} · #{x.login}</span></span>)}</td>
              <td className="muted">{x.broker}</td>
              <td style={{ textAlign: 'right' }}>${Number(x.balance || 0).toLocaleString()}</td>
              <td style={{ textAlign: 'right' }} className={st.net >= 0 ? 'pos' : 'neg'}>{money(st.net)}</td>
              <td style={{ textAlign: 'right' }} className="muted">{st.wr}%</td>
              <td style={{ textAlign: 'right' }}>{editing !== x.id && <button className="btn btn-ghost" onClick={() => { setEditing(x.id); setNick(x.nickname || ''); }}>✏️ Nombre</button>}</td>
            </tr>); })}</tbody>
        </table>
      </Card>

      <p className="muted" style={{ fontSize: 14, margin: '2px 0 -6px' }}>Viendo: <b style={{ color: 'var(--tx)' }}>{curName}</b></p>

      {/* KPIs principales */}
      <div className="grid g4">
        <div className="card kpi"><div className="lbl">💰 Ganancia neta</div><div className={'val ' + (a.net >= 0 ? 'pos' : 'neg')}>{money(a.net)}</div></div>
        <div className="card kpi"><div className="lbl">🎯 Win rate</div><div className="val">{a.winRate.toFixed(0)}%</div></div>
        <div className="card kpi"><div className="lbl">⚖️ Profit factor</div><div className="val">{a.profitFactor.toFixed(2)}</div></div>
        <div className="card kpi"><div className="lbl">📊 Expectancy</div><div className={'val ' + (a.expectancy >= 0 ? 'pos' : 'neg')}>{money(a.expectancy)}</div></div>
      </div>
      <div className="grid g4">
        <div className="card kpi"><div className="lbl">💚 Ganancia media</div><div className="val pos">{money(a.avgWin)}</div></div>
        <div className="card kpi"><div className="lbl">❤️ Pérdida media</div><div className="val neg">{money(-a.avgLoss)}</div></div>
        <div className="card kpi"><div className="lbl">🔀 Payoff ratio</div><div className="val">{a.payoff.toFixed(2)}</div></div>
        <div className="card kpi"><div className="lbl">⏱️ Duración media</div><div className="val" style={{ fontSize: 20 }}>{a.avgDurMin ? fmtDur(a.avgDurMin) : '—'}</div></div>
      </div>
      <div className="grid g4">
        <div className="card kpi"><div className="lbl">🔢 Operaciones</div><div className="val">{a.n}</div></div>
        <div className="card kpi"><div className="lbl">🏆 Mejor trade</div><div className="val pos">{money(a.best)}</div></div>
        <div className="card kpi"><div className="lbl">💀 Peor trade</div><div className="val neg">{money(a.worst)}</div></div>
        <div className="card kpi"><div className="lbl">➖ Break even</div><div className="val" style={{ color: GOLD }}>{a.catBE} · {a.n ? Math.round(100 * a.catBE / a.n) : 0}%</div></div>
      </div>

      {/* Equity + Donut */}
      <div className="grid g2">
        <Card title="Curva de equity" icon="📈">
          {a.equity.length > 1 ? (
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
              <defs><linearGradient id="eq" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BLUE} stopOpacity="0.35" /><stop offset="100%" stopColor={BLUE} stopOpacity="0" /></linearGradient></defs>
              <path d={`${path} L${W},${H} L0,${H} Z`} fill="url(#eq)" />
              <path d={path} fill="none" stroke={BLUE} strokeWidth="2.5" />
            </svg>
          ) : <p className="muted">Aún no hay suficientes operaciones.</p>}
          <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 13, color: 'var(--mut)' }}><span>Drawdown máx: <b style={{ color: RED }}>{money(-a.maxDD)}</b></span><span>Racha máx: <b style={{ color: GREEN }}>{a.maxWin}W</b> / <b style={{ color: RED }}>{a.maxLoss}L</b></span></div>
        </Card>
        <Card title="Resultado de operaciones" icon="🍩"><Donut win={a.catWin} loss={a.catLoss} be={a.catBE} /></Card>
      </div>

      {/* Calendario */}
      <Card title="Calendario de resultados" icon="🗓️" right={<div className="row"><button className={'btn ' + (vw === 'mes' ? 'btn-primary' : 'btn-ghost')} onClick={() => setVw('mes')}>Mes</button><button className={'btn ' + (vw === 'ano' ? 'btn-primary' : 'btn-ghost')} onClick={() => setVw('ano')}>Año</button></div>}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="row"><button className="btn btn-ghost" onClick={prevM}>‹</button><b style={{ minWidth: 130, textAlign: 'center' }}>{MO[calM]} {calY}</b><button className="btn btn-ghost" onClick={nextM}>›</button></div>
          <span style={{ fontSize: 14 }}>Total mes: <b className={monthTotal >= 0 ? 'pos' : 'neg'}>{money(monthTotal)}</b> <span className="muted">({monthTrades} ops)</span></span>
        </div>
        {vw === 'mes' ? (<>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 11, color: 'var(--mut)' }}>{d}</div>)}
            {cells.map((d, i) => { if (d === null) return <div key={i} />; const b = a.daily[dayKey(d)]; const net = b?.net || 0; const inten = b ? Math.min(1, Math.abs(net) / maxDay) : 0; const bg = !b ? 'var(--bg2)' : net >= 0 ? `rgba(52,226,160,${.2 + inten * .6})` : `rgba(255,107,125,${.2 + inten * .6})`; const key = dayKey(d);
              return (<div key={i} onClick={() => b && setSelDay(key === selDay ? null : key)} style={{ background: bg, border: key === selDay ? '2px solid ' + BLUE : '1px solid var(--line)', borderRadius: 8, minHeight: 54, padding: 6, cursor: b ? 'pointer' : 'default' }}><div style={{ fontSize: 11, color: 'var(--mut)' }}>{d}</div>{b && <div style={{ fontSize: 12, fontWeight: 800, marginTop: 4, color: net >= 0 ? '#04150d' : '#1a0509' }}>{money(net)}</div>}{b && <div style={{ fontSize: 10, color: net >= 0 ? '#04150d' : '#1a0509', opacity: .75 }}>{b.count} ops</div>}</div>);
            })}
          </div>
          {selDay && (<div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}><b>Operaciones del {selDay}</b><table style={{ marginTop: 8 }}><tbody>{dayTrades.map((t, i) => (<tr key={i}><td>{t.symbol}</td><td className="muted">{t.side}</td><td className="muted">{new Date(t.close_time).toUTCString().slice(17, 22)}</td><td style={{ textAlign: 'right' }} className={+t.net_profit >= 0 ? 'pos' : 'neg'}>{money(+t.net_profit)}</td></tr>))}</tbody></table></div>)}
        </>) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {MO.map((m, i) => { const key = `${calY}-${String(i + 1).padStart(2, '0')}`; const b = a.byMonth[key]; const net = b?.net || 0;
              return (<div key={i} style={{ background: 'var(--bg2)', borderRadius: 10, padding: 12, borderLeft: '3px solid ' + (b ? (net >= 0 ? GREEN : RED) : 'var(--line)') }}><div className="muted" style={{ fontSize: 12 }}>{m}</div><div style={{ fontWeight: 800, fontSize: 16, color: b ? (net >= 0 ? GREEN : RED) : 'var(--mut)' }}>{b ? money(net) : '—'}</div>{b && <div className="muted" style={{ fontSize: 11 }}>{b.count} ops · {Math.round(100 * b.wins / b.count)}%</div>}</div>);
            })}
          </div>
        )}
      </Card>

      {/* Mejores */}
      <div className="grid g4">
        <div className="card kpi" style={{ borderLeft: '3px solid ' + GREEN }}><div className="lbl">📅 Mejor día</div><div className="val pos" style={{ fontSize: 18 }}>{bWD ? WD[+bWD[0]] : '—'}</div><div className="muted" style={{ fontSize: 12 }}>{bWD ? money(bWD[1].net) : ''}</div></div>
        <div className="card kpi" style={{ borderLeft: '3px solid ' + GREEN }}><div className="lbl">⏰ Mejor hora</div><div className="val pos" style={{ fontSize: 18 }}>{bH ? `${bH[0]}:00` : '—'}</div><div className="muted" style={{ fontSize: 12 }}>{bH ? money(bH[1].net) : ''}</div></div>
        <div className="card kpi" style={{ borderLeft: '3px solid ' + GREEN }}><div className="lbl">🌍 Mejor sesión</div><div className="val pos" style={{ fontSize: 18 }}>{bS ? bS[0] : '—'}</div><div className="muted" style={{ fontSize: 12 }}>{bS ? money(bS[1].net) : ''}</div></div>
        <div className="card kpi" style={{ borderLeft: '3px solid ' + GREEN }}><div className="lbl">💱 Mejor par</div><div className="val pos" style={{ fontSize: 18 }}>{bSym ? bSym[0] : '—'}</div><div className="muted" style={{ fontSize: 12 }}>{bSym ? money(bSym[1].net) : ''}</div></div>
      </div>
      {/* Peores */}
      <div className="grid g4">
        <div className="card kpi" style={{ borderLeft: '3px solid ' + RED }}><div className="lbl">📅 Peor día</div><div className="val neg" style={{ fontSize: 18 }}>{wWD ? WD[+wWD[0]] : '—'}</div><div className="muted" style={{ fontSize: 12 }}>{wWD ? money(wWD[1].net) : ''}</div></div>
        <div className="card kpi" style={{ borderLeft: '3px solid ' + RED }}><div className="lbl">⏰ Peor hora</div><div className="val neg" style={{ fontSize: 18 }}>{wH ? `${wH[0]}:00` : '—'}</div><div className="muted" style={{ fontSize: 12 }}>{wH ? money(wH[1].net) : ''}</div></div>
        <div className="card kpi" style={{ borderLeft: '3px solid ' + RED }}><div className="lbl">🌍 Peor sesión</div><div className="val neg" style={{ fontSize: 18 }}>{wS ? wS[0] : '—'}</div><div className="muted" style={{ fontSize: 12 }}>{wS ? money(wS[1].net) : ''}</div></div>
        <div className="card kpi" style={{ borderLeft: '3px solid ' + RED }}><div className="lbl">💱 Peor par</div><div className="val neg" style={{ fontSize: 18 }}>{wSym ? wSym[0] : '—'}</div><div className="muted" style={{ fontSize: 12 }}>{wSym ? money(wSym[1].net) : ''}</div></div>
      </div>

      {/* Largos vs Cortos + Histograma */}
      <div className="grid g2">
        <Card title="Largos vs Cortos" icon="🔀">
          <BarRow label="🟢 Largos" b={buy} max={maxLS} />
          <BarRow label="🔴 Cortos" b={sell} max={maxLS} />
        </Card>
        <Card title="Distribución de resultados" icon="📊">
          {a.hist.length ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 130, marginTop: 6 }}>
              {a.hist.map((h, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 10, color: 'var(--mut)' }}>{h.count || ''}</div>
                  <div style={{ width: '100%', height: `${Math.max(3, (h.count / maxHist) * 96)}px`, background: h.pos ? 'linear-gradient(180deg,#34e2a0,#12b981)' : 'linear-gradient(180deg,#ff6b7d,#e23b55)', borderRadius: 4 }} />
                  <div style={{ fontSize: 9, color: 'var(--mut)' }}>{h.label}</div>
                </div>
              ))}
            </div>
          ) : <p className="muted">Sin datos.</p>}
        </Card>
      </div>

      {/* Top / Peores pares */}
      <div className="grid g2">
        <Card title="Top 5 mejores pares" icon="🏆">{top.length ? top.map(([sym, b], i) => <BarRow key={i} label={sym} b={b} max={maxTop} />) : <p className="muted">Sin pares en positivo.</p>}</Card>
        <Card title="Top 5 peores pares" icon="💀">{bot.length ? bot.map(([sym, b], i) => <BarRow key={i} label={sym} b={b} max={maxTop} />) : <p className="muted">Sin pares en negativo.</p>}</Card>
      </div>

      {/* Gráficas por tiempo */}
      <div className="grid g2">
        <Card title="Por día de la semana" icon="📆">{weekdayData.map((d, i) => <BarRow key={i} label={d.label} b={d.b} max={maxWD} />)}</Card>
        <Card title="Por sesión" icon="🌍">{sessData.map((d, i) => <BarRow key={i} label={d.label} b={d.b} max={maxS} />)}</Card>
      </div>
      <Card title="Por hora del día" icon="⏰">{hourData.length ? hourData.map((d, i) => <BarRow key={i} label={d.label} b={d.b} max={maxH} />) : <p className="muted">Sin datos.</p>}</Card>
      <Card title="Por mes" icon="🗓️">{monthData.length ? monthData.map((d, i) => <BarRow key={i} label={d.label} b={d.b} max={maxM} />) : <p className="muted">Sin datos.</p>}</Card>
    </div>
  );
}
