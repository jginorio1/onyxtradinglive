'use client';
import { useMemo } from 'react';

type TT = { symbol: string; volume: number; close_time: string; net_profit: number; profit?: number; commission?: number; swap?: number };
type Lang = 'es' | 'en';

const money2 = (n: number) => (n >= 0 ? '+$' : '-$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const C = {
  es: {
    title: '💸 Costes (comisión y swap)', note: 'El swap se muestra neto: negativo si es coste, positivo si te pagan.',
    comm: 'Comisión', swap: 'Swap', total: 'Coste total', perLot: 'Coste por lote',
    today: 'Hoy', week: 'Semana', month: 'Mes', year: 'Año', all: 'Total',
    vsTitle: '⚖️ Coste vs beneficio', gross: 'Ganancia bruta', costs: 'Costes totales', eaten: 'Se comieron', net: 'Ganancia neta',
    byPair: 'Coste por par', noData: 'Sin datos.',
  },
  en: {
    title: '💸 Costs (commission & swap)', note: 'Swap is shown net: negative when a cost, positive when paid to you.',
    comm: 'Commission', swap: 'Swap', total: 'Total cost', perLot: 'Cost per lot',
    today: 'Today', week: 'Week', month: 'Month', year: 'Year', all: 'Total',
    vsTitle: '⚖️ Cost vs benefit', gross: 'Gross profit', costs: 'Total costs', eaten: 'Ate up', net: 'Net profit',
    byPair: 'Cost by pair', noData: 'No data.',
  },
};

export default function Costs({ trades, lang }: { trades: TT[]; lang: Lang }) {
  const t = C[lang];
  const now = new Date();
  const y = now.getUTCFullYear(), mo = now.getUTCMonth(), day = now.getUTCDate();
  const todayStr = now.toISOString().slice(0, 10);
  const weekAgo = new Date(Date.UTC(y, mo, day - 6)).toISOString().slice(0, 10);

  const data = useMemo(() => {
    const preds: [string, (x: TT) => boolean][] = [
      ['today', (x) => x.close_time.slice(0, 10) === todayStr],
      ['week', (x) => x.close_time.slice(0, 10) >= weekAgo],
      ['month', (x) => { const d = new Date(x.close_time); return d.getUTCFullYear() === y && d.getUTCMonth() === mo; }],
      ['year', (x) => new Date(x.close_time).getUTCFullYear() === y],
      ['all', () => true],
    ];
    const cols: Record<string, { comm: number; swap: number; lots: number }> = {};
    preds.forEach(([k, f]) => {
      let comm = 0, swap = 0, lots = 0;
      for (const x of trades) if (f(x)) { comm += +(x.commission || 0); swap += +(x.swap || 0); lots += Math.abs(+x.volume || 0); }
      cols[k] = { comm, swap, lots };
    });

    let gross = 0, netCost = 0; const byPair: Record<string, number> = {};
    for (const x of trades) { gross += +(x.profit ?? x.net_profit) || 0; const c = +(x.commission || 0) + +(x.swap || 0); netCost += c; byPair[x.symbol] = (byPair[x.symbol] || 0) + c; }
    const net = gross + netCost;
    const eaten = gross > 0 ? Math.round(Math.min(100, (Math.abs(netCost) / gross) * 100)) : 0;
    const pairs = Object.entries(byPair).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 6);
    const maxP = Math.max(1, ...pairs.map(([, v]) => Math.abs(v)));
    return { cols, gross, netCost, net, eaten, pairs, maxP };
  }, [trades]);

  const periods = ['today', 'week', 'month', 'year', 'all'] as const;
  const th = { padding: '9px 8px', fontSize: 12, color: 'var(--mut)', textAlign: 'right' as const, borderBottom: '1px solid var(--line)' };
  const td = { padding: '9px 8px', textAlign: 'right' as const, borderBottom: '1px solid var(--line)', fontSize: 13 };
  const cls = (n: number) => (n >= 0 ? 'pos' : 'neg');

  return (
    <>
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>{t.title}</h3>
        <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>{t.note}</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 460 }}>
            <thead><tr><th style={{ ...th, textAlign: 'left' }}></th>{periods.map((p) => <th key={p} style={th}>{t[p]}</th>)}</tr></thead>
            <tbody>
              <tr><td style={{ ...td, textAlign: 'left', color: 'var(--mut)' }}>{t.comm}</td>{periods.map((p) => <td key={p} style={td} className={cls(data.cols[p].comm)}>{money2(data.cols[p].comm)}</td>)}</tr>
              <tr><td style={{ ...td, textAlign: 'left', color: 'var(--mut)' }}>{t.swap}</td>{periods.map((p) => <td key={p} style={td} className={cls(data.cols[p].swap)}>{money2(data.cols[p].swap)}</td>)}</tr>
              <tr><td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{t.total}</td>{periods.map((p) => { const c = data.cols[p].comm + data.cols[p].swap; return <td key={p} style={{ ...td, fontWeight: 700 }} className={cls(c)}>{money2(c)}</td>; })}</tr>
              <tr><td style={{ ...td, textAlign: 'left', color: 'var(--mut)' }}>{t.perLot}</td>{periods.map((p) => { const cst = data.cols[p].comm + data.cols[p].swap; const pl = data.cols[p].lots > 0 ? cst / data.cols[p].lots : 0; return <td key={p} style={td} className={cls(pl)}>{money2(pl)}</td>; })}</tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>{t.vsTitle}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
            <div className="row between"><span className="muted">{t.gross}</span><b className={cls(data.gross)}>{money2(data.gross)}</b></div>
            <div className="row between"><span className="muted">{t.costs}</span><b className={cls(data.netCost)}>{money2(data.netCost)}</b></div>
            <div className="row between"><span className="muted">{t.eaten}</span><b style={{ color: 'var(--amber)' }}>{data.eaten}%</b></div>
            <div style={{ height: 8, background: 'var(--bg2)', borderRadius: 5, overflow: 'hidden' }}><div style={{ width: data.eaten + '%', height: '100%', background: 'linear-gradient(90deg,#ffc04d,#ff6b7d)' }} /></div>
            <div className="row between" style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--line)' }}><span>{t.net}</span><b className={cls(data.net)} style={{ fontSize: 16 }}>{money2(data.net)}</b></div>
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>{t.byPair}</h3>
          {data.pairs.length ? data.pairs.map(([sym, v]) => (
            <div key={sym} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '7px 0' }}>
              <div style={{ width: 84, fontSize: 13 }}>{sym}</div>
              <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 6, height: 18, overflow: 'hidden' }}><div style={{ width: `${Math.max(4, (Math.abs(v) / data.maxP) * 100)}%`, height: '100%', background: v >= 0 ? 'linear-gradient(90deg,#12b981,#34e2a0)' : 'linear-gradient(90deg,#e23b55,#ff6b7d)' }} /></div>
              <div style={{ width: 76, textAlign: 'right', fontSize: 12 }} className={cls(v)}>{money2(v)}</div>
            </div>
          )) : <p className="muted">{t.noData}</p>}
        </div>
      </div>
    </>
  );
}
