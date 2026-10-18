'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import OnyxIcon from '@/app/components/OnyxIcon';

// Admin → Días libres. Sobre nómina + horarios: aprueba/rechaza solicitudes (al
// aprobar, los días salen "libre" en el calendario del horario), ajusta la
// asignación anual por empleado y edita la política por defecto.

const TYPE_ES: any = { vacation: 'Vacaciones', sick: 'Enfermedad', personal: 'Personal' };
const TYPE_EN: any = { vacation: 'Vacation', sick: 'Sick', personal: 'Personal' };
const ST_COLOR: any = { pending: 'var(--amber,#e0a33e)', approved: 'var(--green,#2fbf88)', rejected: 'var(--red,#e5484d)', cancelled: 'var(--mut)' };

export default function Leave({ canManage = true, lang = 'es' }: { canManage?: boolean; lang?: 'es' | 'en' }) {
  const es = lang === 'es';
  const TL = es ? TYPE_ES : TYPE_EN;
  const [d, setD] = useState<any>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [busy, setBusy] = useState('');
  const [pol, setPol] = useState<any>(null);

  async function load() {
    try {
      const r = await fetch('/api/admin/leave' + (filter === 'pending' ? '?status=pending' : ''));
      const j = await r.json(); setD(j); if (!pol) setPol(j.policy);
    } catch {}
  }
  useEffect(() => { load(); }, [filter]);

  async function act(body: any, key = '') {
    setBusy(key);
    try {
      const r = await fetch('/api/admin/leave', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) { toast(j.error || 'Error'); return false; }
      await load(); return true;
    } catch { toast('Error'); return false; } finally { setBusy(''); }
  }

  async function decide(id: string, approve: boolean) {
    const note = approve ? undefined : (window.prompt(es ? 'Motivo del rechazo (opcional):' : 'Rejection reason (optional):') || '');
    if (await act({ action: 'decide', id, approve, admin_note: note }, id)) toast(approve ? (es ? 'Aprobada ✓' : 'Approved ✓') : (es ? 'Rechazada' : 'Rejected'), 'ok');
  }

  if (!d) return <div className="muted" style={{ fontSize: 13 }}>…</div>;
  const reqs: any[] = d.requests || [];
  const inp = { padding: '5px 7px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--tx)', fontSize: 12.5, width: 60, fontFamily: 'inherit' } as any;

  return (
    <div style={{ maxWidth: 'none' }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}><OnyxIcon emoji="🏖️" size={15} /> {es ? 'Días libres' : 'Time off'}</h2>
        <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 0' }}>{es ? 'Aprueba o rechaza solicitudes del equipo. Al aprobar, los días quedan “libre” en el horario y se descuentan del saldo.' : 'Approve or reject team requests. On approval, days become “off” in the schedule and are deducted from the balance.'}</p>
      </div>

      {/* Política por defecto */}
      {canManage && pol && (
        <div className="card" style={{ padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{es ? 'Política por defecto (días/año)' : 'Default policy (days/year)'}</div>
          <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {['vacation', 'sick', 'personal'].map((t) => (
              <label key={t} style={{ fontSize: 12 }}><div className="muted" style={{ marginBottom: 3 }}>{TL[t]}</div>
                <input type="number" min={0} value={pol[t] ?? 0} onChange={(e) => setPol({ ...pol, [t]: Number(e.target.value) })} style={{ ...inp, width: 80 }} />
              </label>
            ))}
            <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={busy === 'pol'} onClick={() => act({ action: 'save_policy', policy: pol }, 'pol').then((o) => o && toast(es ? 'Guardado' : 'Saved', 'ok'))}>{es ? 'Guardar política' : 'Save policy'}</button>
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>{es ? 'Aplica a quien no tenga una asignación propia (más abajo).' : 'Applies to anyone without a custom allotment (below).'}</p>
        </div>
      )}

      {/* Cola de solicitudes */}
      <div className="card" style={{ padding: 14, marginBottom: 16 }}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{es ? 'Solicitudes' : 'Requests'}</div>
          <div className="row" style={{ gap: 6 }}>
            {(['pending', 'all'] as const).map((f) => (
              <button key={f} className="btn" style={{ fontSize: 11.5, padding: '3px 10px', background: filter === f ? 'var(--brand)' : 'var(--bg2)', color: filter === f ? '#0b1020' : 'var(--tx)' }} onClick={() => setFilter(f)}>{f === 'pending' ? (es ? 'Pendientes' : 'Pending') : (es ? 'Todas' : 'All')}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {reqs.map((r) => (
            <div key={r.id} className="row between" style={{ background: 'var(--bg2)', borderRadius: 10, padding: '9px 12px', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.staff_name} · <span style={{ fontWeight: 500 }}>{TL[r.type]}</span></div>
                <div className="muted" style={{ fontSize: 11.5 }}>{r.start_day.slice(5)} → {r.end_day.slice(5)} · {r.days} {es ? 'días' : 'days'}{r.reason ? ` · “${r.reason}”` : ''}</div>
                {r.admin_note && <div className="muted" style={{ fontSize: 11, fontStyle: 'italic' }}>{es ? 'Nota:' : 'Note:'} {r.admin_note}</div>}
              </div>
              <div className="row" style={{ gap: 6, flex: 'none' }}>
                {r.status === 'pending' && canManage ? (
                  <>
                    <button className="btn" style={{ fontSize: 11.5, padding: '4px 11px', background: 'var(--green,#2fbf88)', color: '#0b1020', fontWeight: 700 }} disabled={busy === r.id} onClick={() => decide(r.id, true)}>{es ? 'Aprobar' : 'Approve'}</button>
                    <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '4px 11px' }} disabled={busy === r.id} onClick={() => decide(r.id, false)}>{es ? 'Rechazar' : 'Reject'}</button>
                  </>
                ) : (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: ST_COLOR[r.status] }}>{es ? ({ pending: 'pendiente', approved: 'aprobada', rejected: 'rechazada', cancelled: 'cancelada' } as any)[r.status] : r.status}</span>
                )}
              </div>
            </div>
          ))}
          {!reqs.length && <div className="muted" style={{ fontSize: 12.5 }}>{filter === 'pending' ? (es ? 'No hay solicitudes pendientes 🎉' : 'No pending requests 🎉') : (es ? 'Sin solicitudes.' : 'No requests.')}</div>}
        </div>
      </div>

      {/* Saldos por empleado (asignación editable) */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{es ? `Saldos del equipo · ${d.year}` : `Team balances · ${d.year}`}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(d.staff || []).map((s: any) => (
            <div key={s.id} className="row between" style={{ background: 'var(--bg2)', borderRadius: 10, padding: '9px 12px', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 600, minWidth: 120 }}>{s.name}</div>
              <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
                {['vacation', 'sick', 'personal'].map((t) => (
                  <div key={t} className="row" style={{ gap: 5, alignItems: 'center' }}>
                    <span className="muted" style={{ fontSize: 11 }}>{TL[t]}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: s.balances[t].remaining > 0 ? 'var(--green,#2fbf88)' : 'var(--mut)' }}>{s.balances[t].remaining}</span>
                    <span className="muted" style={{ fontSize: 10.5 }}>/ {canManage
                      ? <input type="number" min={0} defaultValue={s.balances[t].allotted} style={{ ...inp, width: 48, padding: '2px 5px' }} onBlur={(e) => Number(e.target.value) !== s.balances[t].allotted && act({ action: 'set_allotment', staff_id: s.id, year: d.year, type: t, allotted: Number(e.target.value) }, s.id + t)} />
                      : s.balances[t].allotted}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!(d.staff || []).length && <div className="muted" style={{ fontSize: 12.5 }}>{es ? 'No hay empleados en nómina.' : 'No payroll employees.'}</div>}
        </div>
        <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>{es ? 'El número verde = restante. El campo editable = asignado este año (vacío usa la política).' : 'Green number = remaining. Editable field = allotted this year (empty uses policy).'}</p>
      </div>
    </div>
  );
}
