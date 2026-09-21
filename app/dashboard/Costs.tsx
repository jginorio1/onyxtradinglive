'use client';
import { dictFor } from '@/lib/i18n';
import { useMemo } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';

type TT = { account_id?: string; symbol: string; volume: number; close_time: string; net_profit: number; profit?: number; commission?: number; swap?: number };
type Acc = { id: string; nickname?: string | null; broker?: string | null; platform?: string | null };
type Lang = 'es' | 'en';

const money2 = (n: number) => (n >= 0 ? '+$' : '-$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const C = {
  es: {
    title: '💸 Costes (comisión y swap)', note: 'El swap se muestra neto: negativo si es coste, positivo si te pagan.',
    comm: 'Comisión', swap: 'Swap', total: 'Coste total', perLot: 'Coste por lote',
    today: 'Hoy', week: 'Semana', month: 'Mes', year: 'Año', all: 'Total',
    vsTitle: '⚖️ Coste vs beneficio', gross: 'Ganancia bruta', costs: 'Costes totales', eaten: 'Se comieron', net: 'Ganancia neta',
    perOp: 'Coste por operación', naGross: 'N/A · bruto en pérdida',
    byAcc: 'Coste por cuenta / broker', byPair: 'Coste por par', noData: 'Sin datos.',
    account: 'Cuenta', lots: 'Lotes', ops: 'Ops', mix: 'Mezcla varias cuentas. El coste por lote solo se compara bien filtrando UNA cuenta arriba.',
  },
  en: {
    title: '💸 Costs (commission & swap)', note: 'Swap is shown net: negative when a cost, positive when paid to you.',
    comm: 'Commission', swap: 'Swap', total: 'Total cost', perLot: 'Cost per lot',
    today: 'Today', week: 'Week', month: 'Month', year: 'Year', all: 'Total',
    vsTitle: '⚖️ Cost vs benefit', gross: 'Gross profit', costs: 'Total costs', eaten: 'Ate up', net: 'Net profit',
    perOp: 'Cost per trade', naGross: 'N/A · gross in loss',
    byAcc: 'Cost by account / broker', byPair: 'Cost by pair', noData: 'No data.',
    account: 'Account', lots: 'Lots', ops: 'Ops', mix: 'Mixing several accounts. Cost per lot only compares well when you filter ONE account above.',
  },
};

export default function Costs({ trades, lang, accounts = [] }: { trades: TT[]; lang: Lang; accounts?: Acc[] }) {
  const t = dictFor(C, lang);
  const now = new Date();
  const y = now.getUTCFullYear(), mo = now.getUTCMonth(), day = now.getUTCDate();
  const todayStr = now.toISOString().slice(0, 10);
  const weekAgo = new Date(Date.UTC(y, mo, day - 6)).toISOString().slice(0, 10);
  const accById = useMemo(() => { const m: Record<string, Acc> = {}; for (const a of accounts) m[a.id] = a; return m; }, [accounts]);
  const accName = (id?: string) => { const a = id ? accById[id] : null; return (a?.nickname || (id ? '#' + String(id).slice(0, 6) : '—')); };
  const accBroker = (id?: string) => { const a = id ? accById[id] : null; return [a?.broker, a?.platform].filter(Boolean).join(' · '); };

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

    type Agg = { comm: number; swap: number; cost: number; lots: number; ops: number; key: string; sym?: string; acc?: string };
    const mk = (): Agg => ({ comm: 0, swap: 0, cost: 0, lots: 0, ops: 0, key: '' });
    let gross = 0, netCost = 0, commT = 0, swapT = 0, opsT = 0, lotsT = 0;
    const accSet = new Set<string>();
    const byAccM: Record<string, Agg> = {}; const byPairM: Record<string, Agg> = {};
    for (const x of trades) {
      const comm = +(x.commission || 0), swp = +(x.swap || 0), c = comm + swp, lot = Math.abs(+x.volume || 0);
      gross += +(x.profit ?? x.net_profit) || 0; netCost += c; commT += comm; swapT += swp; opsT++; lotsT += lot;
      const aid = x.account_id || '—'; accSet.add(aid);
      const ba = byAccM[aid] || (byAccM[aid] = { ...mk(), key: aid, acc: aid });
      ba.comm += comm; ba.swap += swp; ba.cost += c; ba.lots += lot; ba.ops++;
    }
    const multiAcc = accSet.size > 1;
    for (const x of trades) {
      const comm = +(x.commission || 0), swp = +(x.swap || 0), c = comm + swp, lot = Math.abs(+x.volume || 0);
      const aid = x.account_id || '—';
      const pk = multiAcc ? x.symbol + '@' + aid : x.symbol;
      const bp = byPairM[pk] || (byPairM[pk] = { ...mk(), key: pk, sym: x.symbol, acc: aid });
      bp.comm += comm; bp.swap += swp; bp.cost += c; bp.lots += lot; bp.ops++;
    }
    const net = gross + netCost;
    const eaten = gross > 0 ? Math.round(Math.min(100, (Math.abs(netCost) / gross) * 100)) : null;
    const perOp = opsT > 0 ? netCost / opsT : 0;
    const byAcc = Object.values(byAccM).sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost));
    const byPair = Object.values(byPairM).sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost)).slice(0, 12);
    return { cols, gross, netCost, commT, swapT, opsT, lotsT, net, eaten, perOp, byAcc, byPair, multiAcc };
  }, [trades]);

  const periods = ['today', 'week', 'month', 'year', 'all'] as const;
  const cls = (n: number) => (n >= 0 ? 'pos' : 'neg');
  const perLot = (cost: number, lots: number) => lots > 0 ? cost / lots : 0;
  const ic = t.title.split(' ')[0], titleTx = t.title.split(' ').slice(1).join(' ');
  const icV = t.vsTitle.split(' ')[0], vsTx = t.vsTitle.split(' ').slice(1).join(' ');

  const thL: any = { textAlign: 'left', fontSize: 11.5, color: 'var(--mut)', padding: '0 8px 8px', fontWeight: 400 };
  const thR: any = { ...thL, textAlign: 'right' };
  const cell: any = { padding: '9px 8px', fontSize: 12.5, borderTop: '1px solid var(--line)' };
  const cellR: any = { ...cell, textAlign: 'right' };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tabla por periodo */}
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
              <tr className="jrow"><td style={{ color: 'var(--mut)' }}>{t.perLot}</td>{periods.map((p) => { const cst = data.cols[p].comm + data.cols[p].swap; const pl = perLot(cst, data.cols[p].lots); return <td key={p} style={{ textAlign: 'right' }} className={cls(pl)}>{money2(pl)}</td>; })}</tr>
            </tbody>
          </table>
        </div>
        {data.multiAcc && <p style={{ fontSize: 12, color: 'var(--amber)', margin: '10px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji="⚠️" size={13} /> {t.mix}</p>}
      </div>

      <div className="grid g2" style={{ alignItems: 'stretch' }}>
        {/* Coste vs beneficio */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic"><OnyxIcon emoji={icV} size={16} /></span> {vsTx}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { l: t.gross, v: money2(data.gross), c: data.gross >= 0 ? 'var(--green)' : 'var(--red)' },
              { l: t.costs, v: money2(data.netCost), c: data.netCost >= 0 ? 'var(--green)' : 'var(--red)' },
              { l: t.eaten, v: data.eaten === null ? t.naGross : `${data.eaten}%`, c: 'var(--amber)', sm: data.eaten === null },
              { l: t.net, v: money2(data.net), c: data.net >= 0 ? 'var(--green)' : 'var(--red)' },
              { l: t.perOp, v: money2(data.perOp), c: data.perOp >= 0 ? 'var(--green)' : 'var(--red)' },
              { l: t.comm + ' / ' + t.swap, v: money2(data.commT) + ' / ' + money2(data.swapT), c: 'var(--tx)', sm: true },
            ].map((m: any, i) => (
              <div key={i} style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 14px' }}>
                <div className="muted" style={{ fontSize: 12 }}>{m.l}</div>
                <div style={{ fontSize: m.sm ? 14 : 20, fontWeight: 800, color: m.c, marginTop: 2, letterSpacing: '-.3px' }}>{m.v}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 10, background: 'var(--bg2)', borderRadius: 8, overflow: 'hidden', marginTop: 'auto' }}><div style={{ width: (data.eaten ?? 0) + '%', height: '100%', borderRadius: 8, background: 'linear-gradient(90deg,var(--amber),var(--red))', boxShadow: '0 0 12px -2px rgba(255,107,125,.6)' }} /></div>
        </div>

        {/* Coste por cuenta / broker */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic"><OnyxIcon emoji="🏦" size={16} /></span> {t.byAcc}</h3>
          {data.byAcc.length ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 340 }}>
                <thead><tr><th style={thL}>{t.account}</th><th style={thR}>{t.lots}</th><th style={thR}>{t.ops}</th><th style={thR}>{t.total}</th><th style={thR}>{t.perLot}</th></tr></thead>
                <tbody>
                  {data.byAcc.map((a) => (
                    <tr key={a.key}>
                      <td style={cell}><div style={{ fontWeight: 500 }}>{accName(a.acc)}</div>{accBroker(a.acc) && <div style={{ fontSize: 11, color: 'var(--mut)' }}>{accBroker(a.acc)}</div>}</td>
                      <td style={cellR}>{a.lots.toFixed(1)}</td>
                      <td style={cellR}>{a.ops}</td>
                      <td style={{ ...cellR, fontWeight: 600 }} className={cls(a.cost)}>{money2(a.cost)}</td>
                      <td style={{ ...cellR, fontWeight: 700 }} className={cls(perLot(a.cost, a.lots))}>{money2(perLot(a.cost, a.lots))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted">{t.noData}</p>}
        </div>
      </div>

      {/* Coste por par (con cuenta a la vista + coste/lote) */}
      <div className="card">
        <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic"><OnyxIcon emoji="💱" size={16} /></span> {t.byPair}</h3>
        {data.byPair.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: data.multiAcc ? 560 : 480 }}>
              <thead><tr>
                <th style={thL}>{lang === 'es' ? 'Par' : 'Pair'}</th>
                {data.multiAcc && <th style={thL}>{t.account}</th>}
                <th style={thR}>{t.lots}</th><th style={thR}>{t.comm}</th><th style={thR}>{t.swap}</th><th style={thR}>{t.total}</th><th style={thR}>{t.perLot}</th>
              </tr></thead>
              <tbody>
                {data.byPair.map((p) => (
                  <tr key={p.key}>
                    <td style={{ ...cell, fontWeight: 600 }}>{p.sym}</td>
                    {data.multiAcc && <td style={{ ...cell, color: 'var(--mut)', fontSize: 12 }}>{accName(p.acc)}</td>}
                    <td style={cellR}>{p.lots.toFixed(1)}</td>
                    <td style={cellR} className={cls(p.comm)}>{money2(p.comm)}</td>
                    <td style={cellR} className={cls(p.swap)}>{p.swap === 0 ? '—' : money2(p.swap)}</td>
                    <td style={{ ...cellR, fontWeight: 600 }} className={cls(p.cost)}>{money2(p.cost)}</td>
                    <td style={{ ...cellR, fontWeight: 700 }} className={cls(perLot(p.cost, p.lots))}>{money2(perLot(p.cost, p.lots))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">{t.noData}</p>}
      </div>
    </div>
  );
}
