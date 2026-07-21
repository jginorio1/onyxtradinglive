'use client';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { typeMeta, money2, type Lang } from '@/lib/accountMeta';

const C = {
  es: { title: '🗂️ Comparar cuentas', note: 'Verde = la mejor de cada fila', type: 'Tipo', net: 'Neto', wr: 'Win rate', ops: 'Operaciones', lots: 'Lotaje total', costTotal: 'Coste operativo', costLot: 'Coste / lote', paid: 'Total cobrado', cost: 'Coste challenge', benefit: 'Beneficio real', dd: 'Drawdown máx', none: '—' },
  en: { title: '🗂️ Compare accounts', note: 'Green = best in each row', type: 'Type', net: 'Net', wr: 'Win rate', ops: 'Trades', lots: 'Total lots', costTotal: 'Trading cost', costLot: 'Cost / lot', paid: 'Total paid', cost: 'Challenge cost', benefit: 'Real benefit', dd: 'Max drawdown', none: '—' },
};

export default function CompareAccounts({ accounts, trades, lang }: { accounts: any[]; trades: any[]; lang: Lang }) {
  const t = C[lang];
  const [payouts, setPayouts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch('/api/payouts').then((r) => r.json()).then((j) => {
      const m: Record<string, number> = {};
      (j.payouts || []).forEach((p: any) => { m[p.account_id] = (m[p.account_id] || 0) + (+p.amount || 0); });
      setPayouts(m);
    }).catch(() => {});
  }, []);

  const stats = useMemo(() => accounts.map((acc) => {
    const ts = trades.filter((x) => x.account_id === acc.id);
    let net = 0, wins = 0, lots = 0, tcost = 0;
    for (const x of ts) { const p = +x.net_profit || 0; net += p; if (p >= 0) wins++; lots += Math.abs(+x.volume || 0); tcost += (+x.commission || 0) + (+x.swap || 0); }
    const sorted = [...ts].sort((a, b) => a.close_time.localeCompare(b.close_time));
    let run = 0, peak = 0, maxDD = 0;
    for (const x of sorted) { run += +x.net_profit || 0; if (run > peak) peak = run; if (peak - run > maxDD) maxDD = peak - run; }
    const paid = payouts[acc.id] || 0; const cost = Number(acc.challenge_cost) || 0;
    return { acc, net, wr: ts.length ? Math.round(100 * wins / ts.length) : 0, ops: ts.length, lots, tcost, costLot: lots > 0 ? tcost / lots : 0, paid, cost, benefit: paid - cost, maxDD };
  }), [accounts, trades, payouts]);

  // filas: valor, formato, mejor = alto/bajo
  const rows: { label: string; get: (s: any) => number; fmt: (s: any) => any; hi: 'high' | 'low' | 'none' }[] = [
    { label: t.net, get: (s) => s.net, fmt: (s) => <span className={s.net >= 0 ? 'pos' : 'neg'}>{money2(s.net)}</span>, hi: 'high' },
    { label: t.wr, get: (s) => s.wr, fmt: (s) => s.wr + '%', hi: 'high' },
    { label: t.ops, get: (s) => s.ops, fmt: (s) => s.ops, hi: 'none' },
    { label: t.lots, get: (s) => s.lots, fmt: (s) => s.lots.toFixed(2), hi: 'none' },
    { label: t.costTotal, get: (s) => s.tcost, fmt: (s) => <span className={s.tcost >= 0 ? 'pos' : 'neg'}>{money2(s.tcost)}</span>, hi: 'high' },
    { label: t.costLot, get: (s) => s.costLot, fmt: (s) => <span className={s.costLot >= 0 ? 'pos' : 'neg'}>{money2(s.costLot)}</span>, hi: 'high' },
    { label: t.paid, get: (s) => s.paid, fmt: (s) => <span className="pos">{money2(s.paid)}</span>, hi: 'high' },
    { label: t.cost, get: (s) => s.cost, fmt: (s) => (s.cost ? money2(-s.cost) : t.none), hi: 'low' },
    { label: t.benefit, get: (s) => s.benefit, fmt: (s) => <span className={s.benefit >= 0 ? 'pos' : 'neg'}>{money2(s.benefit)}</span>, hi: 'high' },
    { label: t.dd, get: (s) => s.maxDD, fmt: (s) => <span className="neg">{money2(-s.maxDD)}</span>, hi: 'low' },
  ];

  const bestIdx = (r: typeof rows[0]) => {
    if (r.hi === 'none') return -1;
    let bi = 0, bv = r.get(stats[0]);
    stats.forEach((s, i) => { const v = r.get(s); if (r.hi === 'high' ? v > bv : v < bv) { bv = v; bi = i; } });
    return bi;
  };
  const cols = `130px repeat(${accounts.length}, 1fr)`;
  const cell = { padding: '11px 10px', textAlign: 'center' as const, borderTop: '1px solid #1c2434', borderLeft: '1px solid var(--line)' };
  const best = { background: 'rgba(52,226,160,.12)', fontWeight: 800 as const };

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 4 }}><h3>{t.title}</h3></div>
      <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>{t.note}</p>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols, minWidth: 380, fontSize: 13, border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 10px', background: 'var(--bg2)' }} />
          {accounts.map((acc) => { const m = typeMeta(acc.acc_type); return (
            <div key={acc.id} style={{ padding: '12px 10px', textAlign: 'center', background: 'var(--bg2)', borderLeft: '1px solid var(--line)' }}>
              <b style={{ color: 'var(--tx)' }}>{acc.nickname || '#' + acc.login}</b>
              {m && <div><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: m.color + '22', color: m.color, marginTop: 4, display: 'inline-block' }}>{lang === 'es' ? m.es : m.en}</span></div>}
            </div>); })}
          {rows.map((r, ri) => { const bi = bestIdx(r); return (
            <Fragment key={ri}>
              <div style={{ padding: '11px 10px', color: 'var(--mut)', borderTop: '1px solid #1c2434' }}>{r.label}</div>
              {stats.map((s, ci) => <div key={ri + '-' + ci} style={{ ...cell, ...(ci === bi ? best : {}) }}>{r.fmt(s)}</div>)}
            </Fragment>
          ); })}
        </div>
      </div>
    </div>
  );
}
