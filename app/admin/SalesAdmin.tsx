'use client';
import { useEffect, useState } from 'react';

// Panel ADMIN de la red de ventas: solicitudes, árbol de la red, ajustes de %/topes,
// y pagos. Control total para el dueño.
export default function SalesAdmin({ canManage = true }: { canManage?: boolean }) {
  const [d, setD] = useState<any>(null);
  const [sub, setSub] = useState<'solicitudes' | 'red' | 'ajustes' | 'pagos'>('solicitudes');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => { load(); }, []);
  async function load() { try { const r = await fetch('/api/admin/sales', { cache: 'no-store' }); setD(await r.json()); } catch {} }
  async function act(body: any) {
    setMsg(''); setBusy(body.action + (body.app_id || body.rep_id || ''));
    const r = await fetch('/api/admin/sales', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json(); setBusy('');
    if (j.error) setMsg(j.error); else if (j.code) setMsg('OK'); await load(); return j;
  }

  const card: React.CSSProperties = { background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 12, padding: 14, marginBottom: 10 };
  const inp: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', fontSize: 13 };
  const btn: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--panel,#161c2e)', color: 'var(--tx,#e8ecf5)', cursor: 'pointer', fontSize: 12.5 };
  const btnP: React.CSSProperties = { ...btn, background: 'var(--accent,#8b93ff)', color: '#fff', border: 'none', fontWeight: 600 };

  if (!d) return <div className="muted">Cargando…</div>;
  const s = d.settings || {};
  const reps: any[] = d.reps || [];
  const apps: any[] = (d.applications || []).filter((a: any) => a.status === 'pending');
  const recruitLink = (typeof window !== 'undefined' ? window.location.origin : 'https://www.onyxtradinglive.com') + '/unete-ventas';

  const subBtn = (id: any, label: string, n?: number) => (
    <button onClick={() => setSub(id)} style={{ ...btn, background: sub === id ? 'var(--accent,#8b93ff)' : btn.background, color: sub === id ? '#fff' : btn.color, border: sub === id ? 'none' : btn.border }}>{label}{n ? ` (${n})` : ''}</button>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>🧑‍💼 Red de ventas</h2>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: 12 }}>Landing de reclutamiento:</span>
          <input readOnly value={recruitLink} style={{ ...inp, width: 240 }} />
          <button style={btn} onClick={() => { navigator.clipboard.writeText(recruitLink); setMsg('Enlace copiado ✓'); }}>⧉</button>
        </div>
      </div>

      {msg && <div style={{ ...card, borderColor: 'var(--accent,#8b93ff)', color: 'var(--accent,#8b93ff)' }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {subBtn('solicitudes', 'Solicitudes', apps.length)}
        {subBtn('red', 'La red', reps.length)}
        {subBtn('ajustes', 'Ajustes')}
        {subBtn('pagos', 'Pagos')}
      </div>

      {sub === 'solicitudes' && <div>
        {apps.length === 0 && <div className="muted">No hay solicitudes pendientes.</div>}
        {apps.map((a) => <AppRow key={a.id} a={a} reps={reps} act={act} busy={busy} card={card} inp={inp} btn={btn} btnP={btnP} canManage={canManage} />)}
      </div>}

      {sub === 'red' && <div>
        {canManage && <div style={{ ...card }}>
          <b>Añadir representante manualmente</b>
          <CreateRep reps={reps} act={act} inp={inp} btnP={btnP} />
        </div>}
        {['l2', 'l1', 'vendedor'].map((lvl) => {
          const group = reps.filter((r) => r.level === lvl);
          if (!group.length) return null;
          const title = lvl === 'l2' ? 'Supervisores Nivel 2' : lvl === 'l1' ? 'Supervisores Nivel 1' : 'Vendedores';
          return <div key={lvl} style={{ marginBottom: 10 }}>
            <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', margin: '6px 0' }}>{title}</div>
            {group.map((r) => <RepRow key={r.id} r={r} reps={reps} act={act} busy={busy} card={card} inp={inp} btn={btn} btnP={btnP} canManage={canManage} />)}
          </div>;
        })}
        {reps.length === 0 && <div className="muted">Aún no hay representantes. Aprueba una solicitud o añade uno manualmente.</div>}
      </div>}

      {sub === 'ajustes' && <SettingsBox s={s} act={act} inp={inp} btnP={btnP} card={card} canManage={canManage} />}

      {sub === 'pagos' && <div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Paga a cada representante su saldo disponible (madurado). Stripe = automático · USDT/manual = marcas con referencia.</div>
        {reps.filter((r) => (r.balances?.available || 0) > 0).length === 0 && <div className="muted">Nadie tiene saldo disponible ahora mismo.</div>}
        {reps.filter((r) => (r.balances?.available || 0) > 0).map((r) => <PayRow key={r.id} r={r} act={act} busy={busy} card={card} inp={inp} btn={btn} btnP={btnP} canManage={canManage} />)}
      </div>}
    </div>
  );
}

function AppRow({ a, reps, act, busy, card, inp, btn, btnP, canManage }: any) {
  const [level, setLevel] = useState(a.desired_role === 'supervisor' ? 'l1' : 'vendedor');
  const [parent, setParent] = useState('');
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div><b>{a.name}</b> <span className="muted" style={{ fontSize: 12 }}>· {a.email} · {a.country || '—'} · pide: {a.desired_role}</span></div>
        <span className="muted" style={{ fontSize: 11 }}>{new Date(a.created_at).toLocaleDateString()}</span>
      </div>
      {(a.experience || a.audience || a.note) && <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{[a.experience, a.audience, a.note].filter(Boolean).join(' · ')}</div>}
      {canManage && <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={level} onChange={(e) => setLevel(e.target.value)} style={inp}><option value="vendedor">Vendedor</option><option value="l1">Supervisor N1</option><option value="l2">Supervisor N2</option></select>
        <select value={parent} onChange={(e) => setParent(e.target.value)} style={inp}>
          <option value="">Sin supervisor (tope)</option>
          {reps.filter((r: any) => r.level !== 'vendedor').map((r: any) => <option key={r.id} value={r.id}>{r.email || r.display_name} ({r.level === 'l2' ? 'N2' : 'N1'})</option>)}
        </select>
        <button style={btnP} disabled={busy.startsWith('approve')} onClick={() => act({ action: 'approve', app_id: a.id, email: a.email, level, parent_id: parent || null, display_name: a.name })}>Aprobar</button>
        <button style={btn} onClick={() => act({ action: 'reject', app_id: a.id })}>Rechazar</button>
      </div>}
    </div>
  );
}

function CreateRep({ reps, act, inp, btnP }: any) {
  const [email, setEmail] = useState(''); const [level, setLevel] = useState('vendedor'); const [parent, setParent] = useState('');
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <input placeholder="correo del candidato (ya con cuenta)" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inp, minWidth: 240 }} />
      <select value={level} onChange={(e) => setLevel(e.target.value)} style={inp}><option value="vendedor">Vendedor</option><option value="l1">Supervisor N1</option><option value="l2">Supervisor N2</option></select>
      <select value={parent} onChange={(e) => setParent(e.target.value)} style={inp}><option value="">Sin supervisor</option>{reps.filter((r: any) => r.level !== 'vendedor').map((r: any) => <option key={r.id} value={r.id}>{r.email} ({r.level === 'l2' ? 'N2' : 'N1'})</option>)}</select>
      <button style={btnP} onClick={() => email && act({ action: 'create_rep', email, level, parent_id: parent || null })}>Añadir</button>
    </div>
  );
}

function RepRow({ r, reps, act, busy, card, inp, btn, btnP, canManage }: any) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState(r.level);
  const [parent, setParent] = useState(r.parent_id || '');
  const [rate, setRate] = useState(r.rate_override ?? '');
  const [assign, setAssign] = useState('');
  const b = r.balances || {};
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div>
          <b>{r.display_name || r.email || r.code}</b>
          <span className="muted" style={{ fontSize: 12 }}> · {r.email} · código {r.code} · {r.clients} clientes</span>
          {r.on_hold && <span style={{ marginLeft: 6, color: 'var(--amber,#f0b74e)', fontSize: 12 }}>⏸ pausado</span>}
          {r.status !== 'active' && <span style={{ marginLeft: 6, color: 'var(--red,#f0736f)', fontSize: 12 }}>{r.status}</span>}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 12 }}>disp <b style={{ color: 'var(--green,#5ed6a0)' }}>${b.available || 0}</b> · esp ${b.pending || 0}</span>
          {canManage && <button style={btn} onClick={() => setOpen(!open)}>{open ? 'Cerrar' : 'Editar'}</button>}
        </div>
      </div>
      {open && canManage && <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="muted" style={{ fontSize: 12 }}>Nivel <select value={level} onChange={(e) => setLevel(e.target.value)} style={inp}><option value="vendedor">Vendedor</option><option value="l1">N1</option><option value="l2">N2</option></select></label>
          <label className="muted" style={{ fontSize: 12 }}>Supervisor <select value={parent} onChange={(e) => setParent(e.target.value)} style={inp}><option value="">— (tope)</option>{reps.filter((x: any) => x.id !== r.id && x.level !== 'vendedor').map((x: any) => <option key={x.id} value={x.id}>{x.email} ({x.level === 'l2' ? 'N2' : 'N1'})</option>)}</select></label>
          <label className="muted" style={{ fontSize: 12 }}>% propio <input type="number" placeholder="auto" value={rate} onChange={(e) => setRate(e.target.value)} style={{ ...inp, width: 80 }} /></label>
          <button style={btnP} onClick={() => act({ action: 'set_rep', rep_id: r.id, level, parent_id: parent || null, rate_override: rate })}>Guardar</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={btn} onClick={() => act({ action: 'set_rep', rep_id: r.id, on_hold: !r.on_hold })}>{r.on_hold ? '▶ Reanudar pagos' : '⏸ Pausar pagos'}</button>
          <button style={btn} onClick={() => act({ action: 'set_rep', rep_id: r.id, status: r.status === 'active' ? 'paused' : 'active' })}>{r.status === 'active' ? 'Desactivar' : 'Activar'}</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="asignar cliente por correo" value={assign} onChange={(e) => setAssign(e.target.value)} style={{ ...inp, minWidth: 220 }} />
          <button style={btn} onClick={() => assign && act({ action: 'assign_client', rep_id: r.id, email: assign })}>Asignar cliente</button>
        </div>
      </div>}
    </div>
  );
}

function PayRow({ r, act, busy, card, inp, btn, btnP, canManage }: any) {
  const [ref, setRef] = useState('');
  const b = r.balances || {};
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div><b>{r.display_name || r.email}</b> <span className="muted" style={{ fontSize: 12 }}>· disponible <b style={{ color: 'var(--green,#5ed6a0)' }}>${b.available}</b> · método {r.payout_method || 'stripe'}</span></div>
        {canManage && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={btnP} disabled={busy.startsWith('pay_stripe')} onClick={() => act({ action: 'pay_stripe', rep_id: r.id })}>Pagar por Stripe</button>
          <input placeholder="ref/txid (USDT)" value={ref} onChange={(e) => setRef(e.target.value)} style={{ ...inp, width: 150 }} />
          <button style={btn} onClick={() => act({ action: 'pay_manual', rep_id: r.id, method: 'usdt', ref })}>Marcar pagado (USDT)</button>
        </div>}
      </div>
    </div>
  );
}

function SettingsBox({ s, act, inp, btnP, card, canManage }: any) {
  const [f, setF] = useState(s);
  useEffect(() => { setF(s); }, [s]);
  const u = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const num = (k: string, label: string, suffix = '') => (
    <label className="muted" style={{ fontSize: 12.5, display: 'block' }}>{label}<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="number" value={f[k] ?? 0} onChange={(e) => u(k, Number(e.target.value))} style={{ ...inp, width: 100 }} />{suffix && <span className="muted">{suffix}</span>}</div></label>
  );
  const tog = (k: string, label: string) => (
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={!!f[k]} onChange={(e) => u(k, e.target.checked)} />{label}</label>
  );
  return (
    <div>
      <div style={card}>
        <b>Comisiones (% del pago mensual)</b>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
          {num('direct_rate', 'Vendedor directo', '%')}
          {num('override1_rate', 'Override Supervisor N1', '%')}
          {num('override2_rate', 'Override Supervisor N2', '%')}
          {num('commission_months', 'Meses de comisión (0 = ∞)')}
        </div>
      </div>
      <div style={card}>
        <b>Topes y pagos</b>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
          {num('trial_max_days', 'Máx. días de prueba')}
          {num('discount_max_pct', 'Máx. descuento', '%')}
          {num('hold_days', 'Retención (días)')}
          {num('min_payout', 'Mínimo para pagar', '$')}
        </div>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {tog('enabled', 'Programa activo')}
          {tog('auto_payout', 'Pago automático cuando el saldo madura')}
          {tog('review_before_pay', 'Freno global: revisar antes de pagar (encola)')}
          {tog('allow_recruit', 'Los supervisores pueden reclutar su equipo')}
        </div>
      </div>
      {canManage && <button style={btnP} onClick={() => act({ action: 'save_settings', settings: f })}>Guardar ajustes</button>}
    </div>
  );
}
