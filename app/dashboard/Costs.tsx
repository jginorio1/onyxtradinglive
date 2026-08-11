'use client';
import { dictFor } from '@/lib/i18n';
import { useMemo } from 'react';

type TT = { symbol: string; volume: number; close_time: string; net_profit: number; profit?: number; commission?: number; swap?: number };
type Lang = 'es' | 'en';

import OnyxIcon from '@/app/components/OnyxIcon';
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
  const t = dictFor(C, lang);
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

  const ic = t.title.split(' ')[0], titleTx = t.title.split(' ').slice(1).join(' ');
  const icV = t.vsTitle.split(' ')[0], vsTx = t.vsTitle.split(' ').slice(1).join(' ');

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <h3 style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic"><OnyxIcon emoji={ic} size={16} /></span> {titleTx}</h3>
        <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>{t.note}</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="jtbl" style={{ minWidth: 460 }}>
            <thead><tr><th style={{ textAlign: 'left' }}></th>{periods.map((p) => <th key={p} style={{ textAlign: 'right' }}>{t[p]}</th>)}</tr></thead>
            <tbody>
              <tr className="jrow"><td style={{ color: 'var(--mut)' }}>{t.comm}</td>{periods.map((p) => <td key={p} style={{ textAlign: 'right' }} className={cls(data.cols[p].comm)}>{money2(data.cols[p].comm)}</td>)}</tr>
              <tr className="jrow"><td style={{ color: 'var(--mut)' }}>{t.swap}</td>{periods.map((p) => <td key={p} style={{ textAlign: 'right' }} className={cls(data.cols[p].swap)}>{money2(data.cols[p].swap)}</td>)}</tr>
              <tr className="jrow"><td style={{ fontWeight: 700 }}>{t.total}</td>{periods.map((p) => { const c = data.cols[p].comm + data.cols[p].swap; return <td key={p} style={{ textAlign: 'right' }}><span className={'jchip ' + cls(c)}>{money2(c)}</span></td>; })}</tr>
              <tr className="jrow"><td style={{ color: 'var(--mut)' }}>{t.perLot}</td>{periods.map((p) => { const cst = data.cols[p].comm + data.cols[p].swap; const pl = data.cols[p].lots > 0 ? cst / data.cols[p].lots : 0; return <td key={p} style={{ textAlign: 'right' }} className={cls(pl)}>{money2(pl)}</td>; })}</tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid g2" style={{ alignItems: 'stretch' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic"><OnyxIcon emoji={icV} size={16} /></span> {vsTx}</h3>
          {/* Métricas grandes, mismo peso que Lot statistics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { l: t.gross, v: money2(data.gross), c: data.gross >= 0 ? 'var(--green)' : 'var(--red)' },
              { l: t.costs, v: money2(data.netCost), c: data.netCost >= 0 ? 'var(--green)' : 'var(--red)' },
              { l: t.eaten, v: `${data.eaten}%`, c: 'var(--amber)' },
              { l: t.net, v: money2(data.net), c: data.net >= 0 ? 'var(--green)' : 'var(--red)' },
            ].map((m, i) => (
              <div key={i} style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 14px' }}>
                <div className="muted" style={{ fontSize: 12 }}>{m.l}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: m.c, marginTop: 2, letterSpacing: '-.3px' }}>{m.v}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 10, background: 'var(--bg2)', borderRadius: 8, overflow: 'hidden', marginTop: 'auto' }}><div style={{ width: data.eaten + '%', height: '100%', borderRadius: 8, background: 'linear-gradient(90deg,var(--amber),var(--red))', boxShadow: '0 0 12px -2px rgba(255,107,125,.6)' }} /></div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic"><OnyxIcon emoji="💱" size={16} /></span> {t.byPair}</h3>
          {data.pairs.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.pairs.map(([sym, v]) => (
                <div key={sym} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', borderRadius: 12, padding: '11px 14px' }}>
                  <div style={{ width: 96, fontSize: 13, fontWeight: 500 }}>{sym}</div>
                  <div style={{ flex: 1, background: 'var(--card)', borderRadius: 8, height: 12, overflow: 'hidden' }}><div style={{ width: `${Math.max(4, (Math.abs(v) / data.maxP) * 100)}%`, height: '100%', borderRadius: 8, background: v >= 0 ? 'linear-gradient(90deg,var(--green2),var(--green))' : 'linear-gradient(90deg,var(--red2),var(--red))', boxShadow: v >= 0 ? '0 0 12px -2px rgba(52,226,160,.6)' : '0 0 12px -2px rgba(255,107,125,.6)' }} /></div>
                  <div style={{ width: 84, textAlign: 'right', fontSize: 15, fontWeight: 700 }} className={cls(v)}>{money2(v)}</div>
                </div>
              ))}
            </div>
          ) : <p className="muted">{t.noData}</p>}
        </div>
      </div>
    </div>
  );
}
