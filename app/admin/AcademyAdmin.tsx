'use client';
import { mkL } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';

// Onyx Academy · panel del dueño. Ver academias y EDITAR las comisiones de Onyx:
// el % por defecto (todas) y un % propio por mentor (override). canManage = editable.

export default function AcademyAdmin({ canManage = false }: { canManage?: boolean }) {
  const { lang } = useLang();
  const es = lang !== 'en';
  const L = mkL(lang);
  const [d, setD] = useState<any>(null);
  const [defPct, setDefPct] = useState('');
  const [rowPct, setRowPct] = useState<Record<string, string>>({});
  const [planPct, setPlanPct] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');

  async function load() {
    const r = await fetch('/api/admin/academy');
    const j = await r.json();
    if (!j.error) {
      setD(j);
      setDefPct(String(j.defaultFeePct ?? ''));
      const m: Record<string, string> = {};
      (j.academies || []).forEach((a: any) => { m[a.userId] = a.feePct == null ? '' : String(a.feePct); });
      setRowPct(m);
      const pf: Record<string, string> = {};
      (j.planFees || []).forEach((p: any) => { pf[p.id] = p.fee_pct == null ? '' : String(p.fee_pct); });
      setPlanPct(pf);
    }
  }
  useEffect(() => { load(); }, []);

  async function savePlan(planId: string) {
    setBusy('plan:' + planId);
    await fetch('/api/admin/academy', { method: 'POST', body: JSON.stringify({ action: 'plan', plan_id: planId, fee_pct: planPct[planId] === '' ? '' : Number(planPct[planId]) }) });
    setBusy(''); load();
  }

  async function saveDefault() {
    setBusy('default');
    await fetch('/api/admin/academy', { method: 'POST', body: JSON.stringify({ action: 'default', default_pct: Number(defPct) }) });
    setBusy(''); load();
  }
  async function saveMentor(userId: string) {
    setBusy(userId);
    await fetch('/api/admin/academy', { method: 'POST', body: JSON.stringify({ action: 'mentor', mentor_id: userId, fee_pct: rowPct[userId] === '' ? '' : Number(rowPct[userId]) }) });
    setBusy(''); load();
  }
  async function toggleGuardianPerk(on: boolean) {
    await fetch('/api/admin/academy', { method: 'POST', body: JSON.stringify({ action: 'perks', guardian_autogrant: on }) });
    load();
  }

  const money = (c: number) => '$' + (Math.round((c || 0) / 100)).toLocaleString();

  if (!d) return <div className="card muted">…</div>;

  const list = d.academies || [];
  const totalFee = list.reduce((s: number, a: any) => s + (a.feeCents || 0), 0);
  const totalGross = list.reduce((s: number, a: any) => s + (a.grossCents || 0), 0);
  const totalSales = list.reduce((s: number, a: any) => s + (a.sales || 0), 0);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        {[
          [L('Academias', 'Academies'), String(list.length), 'graduation'],
          [L('Ventas', 'Sales'), String(totalSales), 'cart'],
          [L('Volumen bruto', 'Gross volume'), money(totalGross), 'coins'],
          [L('Comisión Onyx', 'Onyx commission'), money(totalFee), 'gem'],
        ].map(([lbl, val, ic]) => (
          <div key={lbl} className="statcard">
            <div className="statcard-ic"><OnyxIcon name={ic as any} /></div>
            <div><div className="sc-lbl">{lbl}</div><div className="sc-val">{val}</div></div>
          </div>
        ))}
      </div>

      {/* Ingresos reales de la plataforma en Stripe (application fees) + reconciliación */}
      {d.platform && (() => {
        const bal = d.platform.balance; const payouts = d.platform.payouts || [];
        const m2 = (c: number, cur = 'usd') => { const s = (cur || 'usd').toUpperCase(); const sym = s === 'USD' ? '$' : s === 'EUR' ? '€' : ''; return (sym || '') + (c / 100).toLocaleString(es ? 'es-ES' : 'en-US', { minimumFractionDigits: 2 }) + (sym ? '' : ' ' + s); };
        const wh = (iso: string | null) => { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString(es ? 'es-ES' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return '—'; } };
        return (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div className="card-ic"><OnyxIcon name="coins" /></div>
              <b>{L('Ingresos de la plataforma (Stripe)', 'Platform income (Stripe)')}</b>
            </div>
            <p className="muted" style={{ margin: '0 0 10px' }}>{L('Lo que Onyx realmente recibe por comisión (application fees). Compáralo con el libro para reconciliar.', 'What Onyx actually receives as commission (application fees). Compare with the ledger to reconcile.')}</p>
            {bal && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 10 }}>
                <div className="statcard"><div className="statcard-ic" style={{ color: 'var(--soft-green,var(--green))' }}><OnyxIcon name="coins" /></div><div><div className="sc-lbl">{L('Saldo disponible', 'Available')}</div><div className="sc-val">{m2(bal.available, bal.currency)}</div></div></div>
                <div className="statcard"><div className="statcard-ic" style={{ color: 'var(--gold)' }}><OnyxIcon name="duration" /></div><div><div className="sc-lbl">{L('Pendiente', 'Pending')}</div><div className="sc-val">{m2(bal.pending, bal.currency)}</div></div></div>
                <div className="statcard"><div className="statcard-ic"><OnyxIcon name="gem" /></div><div><div className="sc-lbl">{L('Comisión en el libro', 'Ledger commission')}</div><div className="sc-val">{money(totalFee)}</div></div></div>
              </div>
            )}
            {payouts.length > 0 && (
              <div>
                <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{L('Depósitos a tu banco', 'Payouts to your bank')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {payouts.slice(0, 6).map((p: any, i: number) => (
                    <div key={i} className="row between" style={{ fontSize: 13, alignItems: 'center' }}><span className="muted">{wh(p.arrival || p.created)}</span><span className="row" style={{ gap: 10, alignItems: 'center' }}><b>{m2(p.amount_cents, p.currency)}</b><span className="pill" style={{ fontSize: 10, color: p.status === 'paid' ? 'var(--green)' : 'var(--mut)' }}>{p.status}</span></span></div>
                  ))}
                </div>
              </div>
            )}
            {!bal && <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>{L('Conecta/verifica Stripe de plataforma para ver el saldo real.', 'Configure platform Stripe to see the live balance.')}</p>}
          </div>
        );
      })()}

      {/* Comisión por defecto */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div className="card-ic"><OnyxIcon name="gem" /></div>
          <b>{L('Comisión de Onyx por defecto', 'Default Onyx commission')}</b>
        </div>
        <p className="muted" style={{ margin: '0 0 10px' }}>
          {L('Se aplica a toda venta de cualquier academia, salvo que un mentor tenga un % propio abajo.',
             'Applies to every sale of any academy, unless a mentor has a custom % below.')}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input type="number" min={0} max={50} step={0.1} value={defPct} disabled={!canManage}
            onChange={(e) => setDefPct(e.target.value)} className="input" style={{ width: 110 }} />
          <span className="muted">%</span>
          {canManage && (
            <button className="btn btn-primary" disabled={busy === 'default'} onClick={saveDefault}>
              {busy === 'default' ? '…' : L('Guardar', 'Save')}
            </button>
          )}
        </div>
      </div>

      {/* Comisión por PLAN del mentor (baja al subir de plan) */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div className="card-ic"><OnyxIcon name="graduation" /></div>
          <b>{L('Comisión por plan del mentor', 'Commission by mentor plan')}</b>
        </div>
        <p className="muted" style={{ margin: '0 0 10px' }}>
          {L('El plan de Onyx del mentor fija su comisión: entre más alto el plan, menor el %. Deja vacío para que ese plan use el % por defecto. Un % propio por mentor (más abajo) siempre gana.',
             'The mentor’s Onyx plan sets their commission: the higher the plan, the lower the %. Leave empty so that plan uses the default %. A per-mentor custom % (below) always wins.')}
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="jtbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>{L('Plan', 'Plan')}</th>
                <th style={{ padding: '6px 8px' }}>{L('Academia', 'Academy')}</th>
                <th style={{ padding: '6px 8px' }}>% {L('comisión', 'commission')}</th>
              </tr>
            </thead>
            <tbody>
              {(d.planFees || []).map((p: any) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--bd)' }}>
                  <td style={{ padding: '8px' }}><b>{p.name}</b><div className="muted" style={{ fontSize: 12 }}>{p.id}</div></td>
                  <td style={{ padding: '8px' }}>
                    <span className="jchip" style={{ color: p.academy ? 'var(--green)' : 'var(--mut)' }}>{p.academy ? L('Incluida', 'Included') : L('Sin academia', 'No academy')}</span>
                  </td>
                  <td style={{ padding: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="number" min={0} max={50} step={0.1} className="input" style={{ width: 90 }}
                        placeholder={String(d.defaultFeePct)} disabled={!canManage}
                        value={planPct[p.id] ?? ''} onChange={(e) => setPlanPct({ ...planPct, [p.id]: e.target.value })} />
                      <span className="muted">%</span>
                      {canManage && (
                        <button className="btn" disabled={busy === 'plan:' + p.id} onClick={() => savePlan(p.id)} title={L('Guardar % de este plan', 'Save this plan %')}>
                          {busy === 'plan:' + p.id ? '…' : '✓'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Perk: auto-conceder Guardian */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div className="card-ic"><OnyxIcon name="guardian" /></div>
          <b>{L('Niveles VIP que incluyen Onyx Guardian', 'VIP tiers that include Onyx Guardian')}</b>
        </div>
        <p className="muted" style={{ margin: '0 0 10px' }}>
          {L('Si lo activas, cuando un alumno compra un nivel marcado con «Onyx Guardian», se le concede Guardian automáticamente en su propia cuenta mientras la compra siga activa (se revoca al cancelar). Ojo: regalas una función de pago de Onyx.',
             'If enabled, when a student buys a tier flagged with “Onyx Guardian”, they automatically get Guardian on their own account while the purchase is active (revoked on cancel). Note: you give away an Onyx paid feature.')}
        </p>
        <label className="row" style={{ gap: 10, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" checked={!!d.perks?.guardian_autogrant} disabled={!canManage} onChange={(e) => toggleGuardianPerk(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
          {L('Conceder Onyx Guardian automáticamente por perk', 'Auto-grant Onyx Guardian from tier perk')}
        </label>
      </div>

      {/* Academias */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div className="card-ic"><OnyxIcon name="graduation" /></div>
          <b>{L('Academias', 'Academies')}</b>
        </div>
        {list.length === 0 && <p className="muted">{L('Aún no hay mentores con academia.', 'No mentors with an academy yet.')}</p>}
        {list.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="jtbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>{L('Academia', 'Academy')}</th>
                  <th style={{ padding: '6px 8px' }}>{L('Mentor', 'Mentor')}</th>
                  <th style={{ padding: '6px 8px' }}>{L('Estado', 'Status')}</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>{L('Ventas', 'Sales')}</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>{L('Comisión', 'Commission')}</th>
                  <th style={{ padding: '6px 8px' }}>% {L('propio', 'custom')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a: any) => (
                  <tr key={a.userId} style={{ borderTop: '1px solid var(--bd)' }}>
                    <td style={{ padding: '8px' }}>
                      <b>{a.name}</b>
                      <div className="muted" style={{ fontSize: 12 }}>{L('código', 'code')}: {a.code}</div>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <div>{a.mentorName || '—'}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{a.mentorEmail || ''}</div>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <span className="jchip" style={{ color: a.chargesEnabled ? 'var(--green)' : (a.connected ? 'var(--gold)' : 'var(--mut)') }}>
                        {a.chargesEnabled ? L('Cobrando', 'Charging') : a.connected ? L('Conectando…', 'Connecting…') : L('Sin Stripe', 'No Stripe')}
                      </span>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{a.sales}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{money(a.feeCents)}</td>
                    <td style={{ padding: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="number" min={0} max={50} step={0.1} className="input" style={{ width: 84 }}
                          placeholder={String(d.defaultFeePct)} disabled={!canManage}
                          value={rowPct[a.userId] ?? ''} onChange={(e) => setRowPct({ ...rowPct, [a.userId]: e.target.value })} />
                        {canManage && (
                          <button className="btn" disabled={busy === a.userId} onClick={() => saveMentor(a.userId)} title={L('Guardar % de este mentor', 'Save this mentor %')}>
                            {busy === a.userId ? '…' : '✓'}
                          </button>
                        )}
                        <span className="muted" style={{ fontSize: 12 }}>
                          {L('efectivo', 'effective')}: {a.effectiveFeePct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          {L('Deja el % propio vacío para que ese mentor use el % de su plan o el % por defecto. La comisión se cobra automáticamente en cada pago vía Stripe Connect y aparece en Finanzas Onyx.',
             'Leave the custom % empty so that mentor uses their plan % or the default. The commission is charged automatically on each payment via Stripe Connect and shows up in Onyx finances.')}
        </p>
      </div>

      {/* Historial de cambios de comisión */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div className="card-ic"><OnyxIcon name="duration" /></div>
          <b>{L('Historial de cambios de comisión', 'Commission change history')}</b>
        </div>
        {(!d.feeLog || d.feeLog.length === 0) && <p className="muted" style={{ margin: 0 }}>{L('Aún no hay cambios registrados.', 'No changes recorded yet.')}</p>}
        {d.feeLog && d.feeLog.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="jtbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>{L('Fecha', 'Date')}</th>
                  <th style={{ padding: '6px 8px' }}>{L('Quién', 'Who')}</th>
                  <th style={{ padding: '6px 8px' }}>{L('Ámbito', 'Scope')}</th>
                  <th style={{ padding: '6px 8px' }}>{L('Objetivo', 'Target')}</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>{L('Valor', 'Value')}</th>
                </tr>
              </thead>
              <tbody>
                {d.feeLog.map((r: any) => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--bd)' }}>
                    <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString(es ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ padding: '8px' }}>{r.actor_email || '—'}</td>
                    <td style={{ padding: '8px' }}>{r.scope === 'default' ? L('Global', 'Default') : r.scope === 'plan' ? L('Plan', 'Plan') : L('Mentor', 'Mentor')}</td>
                    <td style={{ padding: '8px' }}>{r.target || '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{r.pct == null ? L('(por defecto)', '(default)') : r.pct + '%'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
