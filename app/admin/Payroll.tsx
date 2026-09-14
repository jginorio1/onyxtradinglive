'use client';
import { useEffect, useState } from 'react';

// NÓMINA del equipo interno (encima del área Equipo). Empleados con sueldo fijo,
// pagados por Stripe Connect o USDT/manual. Tarjetas por departamento + corrida
// mensual con aprobación. La IA no decide: tú apruebas cada pago.

const DEPTS: Record<string, { label: string; c: string }> = {
  dev: { label: 'Desarrollo', c: '#8b93ff' },
  management: { label: 'Gerencia', c: '#e5b567' },
  marketing: { label: 'Marketing', c: '#5ed6a0' },
  design: { label: 'Diseño', c: '#f0736f' },
  ops: { label: 'Operaciones', c: '#54c7ec' },
  other: { label: 'Otros', c: '#9aa6bd' },
};
const money = (n: number, c = 'USD') => (c === 'USD' ? '$' : '') + (Math.round((n || 0) * 100) / 100).toLocaleString('en-US') + (c !== 'USD' ? ' ' + c : '');

export default function Payroll({ canManage = true }: { canManage?: boolean }) {
  const [d, setD] = useState<any>(null);
  const [sub, setSub] = useState<'equipo' | 'corrida' | 'ajustes'>('equipo');
  const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState<any>(null); // empleado en edición (o {} para nuevo)

  useEffect(() => { load(); }, []);
  async function load() { try { const r = await fetch('/api/admin/payroll', { cache: 'no-store' }); setD(await r.json()); } catch {} }
  async function act(body: any) {
    setMsg('');
    const r = await fetch('/api/admin/payroll', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (j.error) setMsg('⚠ ' + j.error); else if (j.ok === false && j.error) setMsg('⚠ ' + j.error); else setMsg('Hecho ✓');
    await load(); return j;
  }

  const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', fontSize: 13 };
  const btn: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--panel,#161c2e)', color: 'var(--tx,#e8ecf5)', cursor: 'pointer', fontSize: 12.5 };
  const btnP: React.CSSProperties = { ...btn, background: 'var(--accent,#8b93ff)', color: '#fff', border: 'none', fontWeight: 600 };
  const card: React.CSSProperties = { background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 12, padding: 14 };

  if (!d) return <div className="muted">Cargando nómina…</div>;
  const s = d.settings || {};
  const staff: any[] = d.staff || [];
  const sum = d.summary || {};

  const tile = (label: string, value: any, color?: string) => (
    <div style={{ ...card, minWidth: 130, flex: 1 }}>
      <div style={{ fontSize: 11, color: 'var(--mut,#9aa6bd)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 700, color: color || 'var(--tx,#e8ecf5)', marginTop: 2 }}>{value}</div>
    </div>
  );
  const subBtn = (id: any, label: string) => (
    <button onClick={() => setSub(id)} style={{ ...btn, background: sub === id ? 'var(--accent,#8b93ff)' : btn.background, color: sub === id ? '#fff' : btn.color, border: sub === id ? 'none' : btn.border }}>{label}</button>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Nómina del equipo</h2>
        <span className="muted" style={{ fontSize: 12 }}>Periodo {sum.period}</span>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {tile('Empleados', sum.headcount ?? 0)}
        {tile('Sueldos/mes', money(sum.monthly || 0))}
        {tile('Pagado este mes', money(sum.paid || 0), '#5ed6a0')}
        {tile('Pendiente', money(sum.pending || 0), sum.pending ? '#f0b74e' : undefined)}
      </div>

      {msg && <div style={{ border: '1px solid var(--accent,#8b93ff)', color: 'var(--accent,#8b93ff)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {subBtn('equipo', `Equipo (${staff.length})`)}
        {subBtn('corrida', 'Corrida del mes')}
        {subBtn('ajustes', 'Ajustes')}
      </div>

      {/* ===== EQUIPO ===== */}
      {sub === 'equipo' && <div>
        {canManage && <button style={{ ...btnP, marginBottom: 12 }} onClick={() => setEdit({ department: 'dev', payout_method: 'stripe', status: 'active', currency: s.currency || 'USD' })}>+ Añadir empleado</button>}
        {staff.length === 0 ? <div className="muted">Aún no hay empleados. Añade el primero.</div> :
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
            {staff.map((e) => {
              const dp = DEPTS[e.department] || DEPTS.other;
              return (
                <div key={e.id} style={{ ...card, borderLeft: `3px solid ${dp.c}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--tx,#e8ecf5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                      <div style={{ fontSize: 12, color: dp.c }}>{dp.label}{e.position ? ` · ${e.position}` : ''}</div>
                    </div>
                    <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 20, background: e.status === 'active' ? 'rgba(94,214,160,.15)' : 'rgba(240,115,111,.15)', color: e.status === 'active' ? '#5ed6a0' : '#f0736f' }}>{e.status === 'active' ? 'activo' : e.status === 'paused' ? 'pausa' : 'baja'}</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx,#e8ecf5)', marginTop: 8 }}>{money(e.salary, e.currency)}<span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>/mes</span></div>
                  <div style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', marginTop: 2 }}>
                    {e.payout_method === 'stripe' ? (e.payouts_enabled ? 'Stripe ✓' : 'Stripe (sin conectar)') : e.payout_method === 'usdt' ? 'USDT' : 'Manual'}
                    {' · '}pagado {new Date().getFullYear()}: {money(e.paid_ytd || 0)}
                  </div>
                  {!e.user_id && <div style={{ fontSize: 10.5, color: 'var(--amber,#f0b74e)', marginTop: 3 }}>Sin cuenta ligada · solo pago manual</div>}
                  {e.on_hold && <div style={{ fontSize: 10.5, color: '#f0b74e', marginTop: 3 }}>⏸ Pagos en pausa</div>}
                  {canManage && <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    <button style={{ ...btn, flex: 1, padding: '5px 8px' }} onClick={() => setEdit({ ...e })}>Editar</button>
                    <button style={{ ...btn, padding: '5px 8px' }} onClick={() => act({ action: 'set_staff', staff_id: e.id, on_hold: !e.on_hold })}>{e.on_hold ? '▶' : '⏸'}</button>
                    <button style={{ ...btn, padding: '5px 8px' }} onClick={() => act({ action: 'set_staff', staff_id: e.id, status: e.status === 'active' ? 'ended' : 'active' })}>{e.status === 'active' ? 'Baja' : 'Alta'}</button>
                  </div>}
                </div>
              );
            })}
          </div>}
      </div>}

      {/* ===== CORRIDA DEL MES ===== */}
      {sub === 'corrida' && <div>
        <div style={{ ...card, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)' }}>Arma la nómina del mes con el sueldo de cada empleado activo. Luego pagas uno por uno.</div>
          {canManage && <button style={btnP} onClick={() => act({ action: 'build_payrun' })}>Armar nómina de {sum.period}</button>}
        </div>
        {(d.payments || []).length === 0 ? <div className="muted">Aún no has armado la nómina de este mes.</div> :
          <div style={{ display: 'grid', gap: 8 }}>
            {(d.payments || []).map((p: any) => (
              <div key={p.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <b style={{ color: 'var(--tx,#e8ecf5)' }}>{p.staff?.name || '—'}</b>
                  <span className="muted" style={{ fontSize: 12 }}> · {money(p.amount, p.currency)} · {p.method}</span>
                  <div style={{ fontSize: 11, color: p.status === 'paid' ? '#5ed6a0' : p.status === 'skipped' ? '#9aa6bd' : '#f0b74e' }}>{p.status === 'paid' ? `pagado · ${p.ref || ''}` : p.status === 'skipped' ? 'saltado' : 'pendiente'}</div>
                </div>
                {canManage && p.status !== 'paid' && p.status !== 'skipped' && <PayRow p={p} act={act} btn={btn} btnP={btnP} inp={inp} />}
              </div>
            ))}
          </div>}
      </div>}

      {/* ===== AJUSTES ===== */}
      {sub === 'ajustes' && <SettingsBox s={s} act={act} inp={inp} btnP={btnP} card={card} canManage={canManage} />}

      {edit && <StaffModal e={edit} act={act} onClose={() => setEdit(null)} inp={inp} btn={btn} btnP={btnP} depts={s.departments || Object.keys(DEPTS)} />}
    </div>
  );
}

function PayRow({ p, act, btn, btnP, inp }: any) {
  const [ref, setRef] = useState('');
  const canStripe = p.method === 'stripe' && p.staff?.payouts_enabled && !p.staff?.on_hold;
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {canStripe && <button style={btnP} onClick={() => act({ action: 'pay_stripe', payment_id: p.id })}>Pagar por Stripe</button>}
      <input placeholder="ref/txid (manual)" value={ref} onChange={(e) => setRef(e.target.value)} style={{ ...inp, width: 130 }} />
      <button style={btn} onClick={() => act({ action: 'pay_manual', payment_id: p.id, method: p.method === 'usdt' ? 'usdt' : 'manual', ref })}>Marcar pagado</button>
      <button style={btn} onClick={() => act({ action: 'skip_payment', payment_id: p.id })}>Saltar</button>
    </div>
  );
}

function StaffModal({ e, act, onClose, inp, btn, btnP, depts }: any) {
  const [f, setF] = useState<any>({ ...e });
  const u = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const lbl: React.CSSProperties = { fontSize: 12, color: 'var(--mut,#9aa6bd)', display: 'block', marginBottom: 4 };
  const DL: Record<string, string> = { dev: 'Desarrollo', management: 'Gerencia', marketing: 'Marketing', design: 'Diseño', ops: 'Operaciones', other: 'Otros' };
  async function save() { const r = await act({ action: 'save_staff', staff: f }); if (r?.ok) onClose(); }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 90, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 24, overflowY: 'auto' }}>
      <div onClick={(ev) => ev.stopPropagation()} style={{ width: 'min(520px,100%)', background: 'var(--bg,#0e1220)', border: '1px solid var(--line,#2a3350)', borderRadius: 14, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{f.id ? 'Editar empleado' : 'Nuevo empleado'}</h3>
          <button onClick={onClose} style={btn}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ gridColumn: '1 / -1' }}><span style={lbl}>Nombre *</span><input style={{ ...inp, width: '100%' }} value={f.name || ''} onChange={(ev) => u('name', ev.target.value)} /></label>
          <label style={{ gridColumn: '1 / -1' }}><span style={lbl}>Correo (para ligar su cuenta y panel; opcional)</span><input style={{ ...inp, width: '100%' }} value={f.email || ''} onChange={(ev) => u('email', ev.target.value)} placeholder="juan@correo.com" /></label>
          <label><span style={lbl}>Departamento</span><select style={{ ...inp, width: '100%' }} value={f.department} onChange={(ev) => u('department', ev.target.value)}>{depts.map((dk: string) => <option key={dk} value={dk}>{DL[dk] || dk}</option>)}</select></label>
          <label><span style={lbl}>Puesto</span><input style={{ ...inp, width: '100%' }} value={f.position || ''} onChange={(ev) => u('position', ev.target.value)} placeholder="Backend Sr." /></label>
          <label><span style={lbl}>Sueldo mensual</span><input type="number" style={{ ...inp, width: '100%' }} value={f.salary ?? 0} onChange={(ev) => u('salary', ev.target.value)} /></label>
          <label><span style={lbl}>Moneda</span><input style={{ ...inp, width: '100%' }} value={f.currency || 'USD'} onChange={(ev) => u('currency', ev.target.value)} /></label>
          <label><span style={lbl}>Método de cobro</span><select style={{ ...inp, width: '100%' }} value={f.payout_method} onChange={(ev) => u('payout_method', ev.target.value)}><option value="stripe">Stripe</option><option value="usdt">USDT</option><option value="manual">Manual</option></select></label>
          <label><span style={lbl}>Fecha de inicio</span><input type="date" style={{ ...inp, width: '100%' }} value={f.start_date || ''} onChange={(ev) => u('start_date', ev.target.value)} /></label>
          <label style={{ gridColumn: '1 / -1' }}><span style={lbl}>Nota (opcional)</span><textarea style={{ ...inp, width: '100%', minHeight: 50, resize: 'vertical' }} value={f.note || ''} onChange={(ev) => u('note', ev.target.value)} /></label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <button style={btn} onClick={onClose}>Cancelar</button>
          <button style={btnP} onClick={save}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

function SettingsBox({ s, act, inp, btnP, card, canManage }: any) {
  const [f, setF] = useState<any>({ ...s });
  useEffect(() => { setF({ ...s }); }, [s]);
  const u = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const tog = (k: string, label: string, hint?: string) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, cursor: 'pointer', color: 'var(--tx,#e8ecf5)', padding: '3px 0' }}>
      <input type="checkbox" checked={!!f[k]} onChange={(e) => u(k, e.target.checked)} style={{ width: 16, height: 16, flex: 'none', margin: 0 }} />
      <span>{label}{hint && <span className="muted" style={{ fontSize: 11.5 }}> · {hint}</span>}</span>
    </label>
  );
  return (
    <div>
      <div style={card}>
        <b>Cómo se paga</b>
        <div style={{ display: 'grid', gap: 4, marginTop: 10, maxWidth: 520 }}>
          {tog('enabled', 'Nómina activa')}
          {tog('review_before_pay', 'Revisar antes de pagar', 'recomendado: arma la nómina pero apruebas tú')}
          {tog('auto_pay', 'Pago automático por Stripe el día de pago', 'requiere desactivar "revisar antes de pagar"')}
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)' }}>Día de pago del mes<input type="number" min={1} max={28} value={f.pay_day ?? 1} onChange={(e) => u('pay_day', Number(e.target.value))} style={{ ...inp, display: 'block', marginTop: 4, width: 90 }} /></label>
          <label style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)' }}>Moneda base<input value={f.currency || 'USD'} onChange={(e) => u('currency', e.target.value)} style={{ ...inp, display: 'block', marginTop: 4, width: 90 }} /></label>
        </div>
      </div>
      {canManage && <button style={btnP} onClick={() => act({ action: 'save_settings', settings: f })}>Guardar ajustes</button>}
    </div>
  );
}
