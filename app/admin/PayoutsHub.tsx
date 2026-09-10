'use client';
import { useEffect, useMemo, useState } from 'react';
import { toast, toastErr, confirmDialog } from '@/lib/toast';
import { fmtDateTime } from '@/lib/fmtDate';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';

// ============================================================
// PAGOS Y RETIROS (ADMIN) · un solo tablero para trabajar las solicitudes de
// retiro de todos los programas: KPIs, filtro por programa/estado, y por cada
// fila Pagar / Retener / Liberar. Cada acción usa el motor de su programa.
// ============================================================

const money = (c: number) => '$' + (Math.round(c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

type Row = {
  id: string; program: string; programLabel: string; icon: string;
  userId: string | null; who: string; amountCents: number; currency: string;
  method: string; destination: string; status: string; createdAt: string; paidAt: string | null; note: string;
  readonly?: boolean; by?: string;
};
type Data = {
  currency: string;
  kpis: { toPayCents: number; onHoldCents: number; usdtUnconfirmed: number; paidMonthCents: number; pendingCount: number; directMonthCents: number };
  rows: Row[];
  infoRows: Row[];
};

export default function PayoutsHub({ canManage }: { canManage: boolean }) {
  const { lang } = useLang();
  const es = lang !== 'en';
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [prog, setProg] = useState<'all' | 'botlab' | 'ambassador'>('all');
  const [st, setSt] = useState<'pendientes' | 'retenidos' | 'pagados' | 'todos'>('pendientes');
  const [showInfo, setShowInfo] = useState(false);

  async function load() {
    setLoading(true);
    try { const r = await fetch('/api/admin/payouts', { cache: 'no-store' }); const j = await r.json(); if (r.ok) setD(j); else toastErr(j?.error); } catch (e: any) { toastErr(e?.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function act(action: string, row: Row) {
    if (!canManage) { toastErr(es ? 'No tienes permiso para gestionar pagos.' : 'You do not have permission to manage payouts.'); return; }
    if (action === 'pay') {
      const ok = await confirmDialog(es
        ? `¿Pagar ${money(row.amountCents)} a ${row.who} (${row.programLabel})? Si es Stripe se transfiere ya; si es USDT/banco, márcalo pagado tras enviarlo.`
        : `Pay ${money(row.amountCents)} to ${row.who} (${row.programLabel})? Stripe transfers now; for USDT/bank, mark it paid after sending.`);
      if (!ok) return;
    }
    setBusy(row.program + row.id);
    try {
      const r = await fetch('/api/admin/payouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, program: row.program, id: row.id }) });
      const j = await r.json(); if (!r.ok) throw new Error(j?.error || 'error');
      toast(action === 'pay' ? (j.manual ? (es ? 'Marcado como pagado ✓' : 'Marked paid ✓') : (es ? 'Pago enviado ✓' : 'Payout sent ✓')) : action === 'hold' ? (es ? 'Retenido' : 'Held') : (es ? 'Liberado' : 'Released'));
      await load();
    } catch (e: any) { toastErr(e?.message); }
    finally { setBusy(''); }
  }

  const rows = useMemo(() => {
    let rs = d?.rows || [];
    if (prog !== 'all') rs = rs.filter((r) => r.program === prog);
    if (st === 'pendientes') rs = rs.filter((r) => r.status === 'pending');
    else if (st === 'retenidos') rs = rs.filter((r) => r.status === 'on_hold');
    else if (st === 'pagados') rs = rs.filter((r) => r.status === 'paid');
    return rs;
  }, [d, prog, st]);

  function exportCsv() {
    const head = ['programa', 'quien', 'monto', 'moneda', 'metodo', 'destino', 'estado', 'creado', 'pagado', 'nota'];
    const lines = [head.join(',')];
    for (const r of rows) {
      const vals = [r.programLabel, r.who, (r.amountCents / 100).toFixed(2), r.currency, r.method, r.destination, r.status, r.createdAt, r.paidAt || '', (r.note || '').replace(/[\r\n,]/g, ' ')];
      lines.push(vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `pagos-retiros-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  const k = d?.kpis;
  const badge = (status: string) => {
    const map: any = {
      pending: [es ? 'Por pagar' : 'To pay', 'var(--amber)'],
      on_hold: [es ? 'Retenido' : 'Held', 'var(--mut)'],
      paid: [es ? 'Pagado' : 'Paid', 'var(--green)'],
      rejected: [es ? 'Rechazado' : 'Rejected', 'var(--red)'],
    };
    const [lbl, col] = map[status] || [status, 'var(--mut)'];
    return <span style={{ fontSize: 10.5, fontWeight: 800, color: col, border: `1px solid color-mix(in srgb,${col} 40%,transparent)`, borderRadius: 99, padding: '2px 8px', whiteSpace: 'nowrap' }}>{lbl}</span>;
  };
  const methodChip = (m: string) => {
    const usdt = /usdt|crypto|cripto|trc|erc/i.test(m);
    return <span style={{ fontSize: 10.5, fontWeight: 700, color: usdt ? '#26a17b' : 'var(--brand)' }}>{usdt ? '₮ USDT' : m === 'stripe' ? '🏦 Stripe' : m === 'credit' ? (es ? '🎁 Crédito' : '🎁 Credit') : m}</span>;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ margin: '0 0 3px', fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}><OnyxIcon emoji="💸" size={22} /> {es ? 'Pagos y retiros' : 'Payouts'}</h2>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>{es ? 'Todas las solicitudes de retiro de tus programas, en un solo lugar. Cada pago usa el motor y las protecciones de su programa.' : 'Every payout request across your programs, in one place. Each payout uses its program\'s engine and protections.'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} className="btn btn-ghost" style={{ fontSize: 12.5 }}>{es ? 'Refrescar' : 'Refresh'}</button>
          <button onClick={exportCsv} className="btn btn-ghost" style={{ fontSize: 12.5 }}>CSV</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi label={es ? 'Por pagar' : 'To pay'} value={money(k?.toPayCents || 0)} sub={`${k?.pendingCount || 0} ${es ? 'solicitudes' : 'requests'}`} color="var(--amber)" />
        <Kpi label={es ? 'En espera / retenido' : 'On hold'} value={money(k?.onHoldCents || 0)} color="var(--mut)" />
        <Kpi label={es ? 'USDT sin confirmar' : 'USDT unconfirmed'} value={String(k?.usdtUnconfirmed || 0)} sub={es ? 'sin dirección' : 'no address'} color={(k?.usdtUnconfirmed || 0) > 0 ? 'var(--red)' : 'var(--green)'} />
        <Kpi label={es ? 'Pagado (este mes)' : 'Paid (this month)'} value={money(k?.paidMonthCents || 0)} color="var(--green)" />
        <Kpi label={es ? 'Directo a Stripe (mes)' : 'Direct to Stripe (month)'} value={money(k?.directMonthCents || 0)} sub={es ? 'informativo' : 'informational'} color="var(--brand)" />
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {([['all', es ? 'Todos' : 'All'], ['botlab', '🤖 Bot Lab'], ['ambassador', es ? '📣 Embajador' : '📣 Ambassador']] as [any, string][]).map(([k2, l]) => (
          <Chip key={k2} on={prog === k2} onClick={() => setProg(k2)}>{l}</Chip>
        ))}
        <span style={{ width: 1, background: 'var(--line)', margin: '0 4px' }} />
        {([['pendientes', es ? 'Por pagar' : 'To pay'], ['retenidos', es ? 'Retenidos' : 'Held'], ['pagados', es ? 'Pagados' : 'Paid'], ['todos', es ? 'Todos' : 'All']] as [any, string][]).map(([k2, l]) => (
          <Chip key={k2} on={st === k2} onClick={() => setSt(k2)}>{l}</Chip>
        ))}
      </div>

      {/* Tabla */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div className="muted" style={{ padding: 28, textAlign: 'center' }}>{es ? 'Cargando…' : 'Loading…'}</div>
        ) : rows.length === 0 ? (
          <div className="muted" style={{ padding: 28, textAlign: 'center' }}>{es ? 'No hay solicitudes en este filtro.' : 'No requests in this filter.'}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--mut)', fontSize: 11.5 }}>
                  <th style={th}>{es ? 'Programa' : 'Program'}</th>
                  <th style={th}>{es ? 'Quién' : 'Who'}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{es ? 'Monto' : 'Amount'}</th>
                  <th style={th}>{es ? 'Método / destino' : 'Method / dest.'}</th>
                  <th style={th}>{es ? 'Estado' : 'Status'}</th>
                  <th style={th}>{es ? 'Fecha' : 'Date'}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{es ? 'Acciones' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const b = busy === r.program + r.id;
                  const usdtNoAddr = /usdt|crypto|cripto|trc|erc/i.test(r.method) && !r.destination.trim();
                  return (
                    <tr key={r.program + r.id} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={td}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji={r.icon} size={16} /> {r.programLabel}</span></td>
                      <td style={td}><span style={{ fontWeight: 600 }}>{r.who}</span></td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 800 }}>{money(r.amountCents)}</td>
                      <td style={td}>
                        <div>{methodChip(r.method)}</div>
                        {r.destination && <div className="muted" style={{ fontSize: 10.5, fontFamily: 'ui-monospace,monospace', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.destination}>{r.destination}</div>}
                        {usdtNoAddr && <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--red)' }}>{es ? '⚠ sin dirección' : '⚠ no address'}</div>}
                      </td>
                      <td style={td}>{badge(r.status)}</td>
                      <td style={{ ...td, color: 'var(--mut)', fontSize: 12, whiteSpace: 'nowrap' }}>{r.createdAt ? fmtDateTime(r.createdAt) : '—'}</td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {r.status === 'paid' ? <span className="muted" style={{ fontSize: 12 }}>{es ? '✓ Pagado' : '✓ Paid'}</span> : (
                          <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button disabled={b || !canManage || usdtNoAddr} onClick={() => act('pay', r)} title={usdtNoAddr ? (es ? 'Falta la dirección USDT' : 'USDT address missing') : ''} style={{ ...btnPay, opacity: (b || !canManage || usdtNoAddr) ? .5 : 1, cursor: (b || !canManage || usdtNoAddr) ? 'not-allowed' : 'pointer' }}>{es ? 'Pagar' : 'Pay'}</button>
                            {r.status === 'on_hold'
                              ? <button disabled={b || !canManage} onClick={() => act('release', r)} style={{ ...btnGhost, opacity: (b || !canManage) ? .5 : 1 }}>{es ? 'Liberar' : 'Release'}</button>
                              : <button disabled={b || !canManage} onClick={() => act('hold', r)} style={{ ...btnGhost, opacity: (b || !canManage) ? .5 : 1 }}>{es ? 'Retener' : 'Hold'}</button>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* INFORMATIVO · no lo pagas tú (mentor / registro / directo a Stripe) */}
      {(d?.infoRows?.length || 0) > 0 && (
        <div style={{ marginTop: 22 }}>
          <button onClick={() => setShowInfo((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx)', fontSize: 15, fontWeight: 800, padding: 0 }}>
            <span style={{ transform: showInfo ? 'rotate(90deg)' : 'none', transition: '.15s', display: 'inline-block' }}>▸</span>
            {es ? 'Informativo · no lo pagas tú' : 'Informational · you don\'t pay these'} <span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>({d?.infoRows?.length})</span>
          </button>
          <div className="muted" style={{ fontSize: 12, margin: '4px 0 10px' }}>{es ? 'Academia · afiliados lo paga el mentor a sus referidos; las cuentas fondeadas son el registro personal del trader. Aquí solo para que veas el panorama completo.' : 'Academy affiliate is paid by the mentor to their referrers; funded accounts are the trader\'s personal record. Shown here just for the full picture.'}</div>
          {showInfo && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--mut)', fontSize: 11.5 }}>
                    <th style={th}>{es ? 'Origen' : 'Source'}</th>
                    <th style={th}>{es ? 'Quién' : 'Who'}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{es ? 'Monto' : 'Amount'}</th>
                    <th style={th}>{es ? 'Lo paga' : 'Paid by'}</th>
                    <th style={th}>{es ? 'Fecha' : 'Date'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(d?.infoRows || []).slice(0, 60).map((r) => (
                    <tr key={r.program + r.id} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={td}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji={r.icon} size={16} /> {r.programLabel}</span></td>
                      <td style={td}>{r.who}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 800 }}>{money(r.amountCents)}</td>
                      <td style={{ ...td, color: 'var(--mut)' }}>{r.by === 'mentor' ? (es ? 'El mentor' : 'The mentor') : r.by === 'trader' ? (es ? 'Registro del trader' : 'Trader record') : '—'}</td>
                      <td style={{ ...td, color: 'var(--mut)', fontSize: 12, whiteSpace: 'nowrap' }}>{r.createdAt ? fmtDateTime(r.createdAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!canManage && <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>{es ? 'Solo lectura: necesitas permiso de Finanzas o Embajadores (o ser dueño) para pagar o retener.' : 'Read-only: you need Finance or Ambassadors permission (or be the owner) to pay or hold.'}</div>}
      <div className="muted" style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.6 }}>
        {es ? 'Onyx Copy (proveedor) y Academia (mentor) cobran directo a su Stripe, así que no generan solicitudes aquí. «Invita y gana» se aplica como crédito automático. Cada pago respeta la maduración y las protecciones de su programa.' : 'Onyx Copy (provider) and Academy (mentor) get paid straight to their Stripe, so they raise no requests here. “Invite & earn” is applied as automatic credit. Each payout respects its program\'s maturation and protections.'}
      </div>
    </div>
  );
}

const th: any = { padding: '10px 12px', fontWeight: 700 };
const td: any = { padding: '10px 12px', verticalAlign: 'top' };
const btnPay: any = { padding: '6px 12px', borderRadius: 8, border: 'none', fontWeight: 800, fontSize: 12, background: 'var(--green)', color: '#0b1020' };
const btnGhost: any = { padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line)', fontWeight: 700, fontSize: 12, background: 'transparent', color: 'var(--tx)', cursor: 'pointer' };

function Kpi({ label, value, sub, color }: any) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 11 }}>{sub}</div>}
    </div>
  );
}
function Chip({ on, onClick, children }: any) {
  return (
    <button onClick={onClick} style={{ padding: '7px 13px', borderRadius: 99, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', border: `1.5px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'color-mix(in srgb,var(--brand) 12%,transparent)' : 'var(--bg2)', color: on ? 'var(--brand)' : 'var(--tx)' }}>{children}</button>
  );
}
