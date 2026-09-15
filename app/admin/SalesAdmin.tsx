'use client';
import { useEffect, useState } from 'react';
import SalesPerf from './SalesPerf';

// Panel ADMIN de la red de ventas · rediseño moderno:
// tarjetas de color por nivel, arrastrar y soltar para mover vendedores en el
// árbol, nombres de posición personalizados, CV adjunto y pagos.

const LV = {
  l2: { bg: 'rgba(229,181,103,.14)', bd: 'rgba(229,181,103,.45)', fg: '#e5b567' },
  l1: { bg: 'rgba(139,147,255,.15)', bd: 'rgba(139,147,255,.5)', fg: '#a9b0ff' },
  vendedor: { bg: 'rgba(94,214,160,.13)', bd: 'rgba(94,214,160,.5)', fg: '#5ed6a0' },
} as const;

export default function SalesAdmin({ canManage = true }: { canManage?: boolean }) {
  const [d, setD] = useState<any>(null);
  const [sub, setSub] = useState<'solicitudes' | 'red' | 'desempeno' | 'ajustes' | 'pagos'>('red');
  const [msg, setMsg] = useState('');
  const [dragId, setDragId] = useState<string>('');

  useEffect(() => { load(); }, []);
  async function load() { try { const r = await fetch('/api/admin/sales', { cache: 'no-store' }); setD(await r.json()); } catch {} }
  async function act(body: any) {
    setMsg('');
    const r = await fetch('/api/admin/sales', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (j.error) setMsg('⚠ ' + j.error); else setMsg('Hecho ✓');
    await load(); return j;
  }

  const inp: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', fontSize: 13 };
  const btn: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--panel,#161c2e)', color: 'var(--tx,#e8ecf5)', cursor: 'pointer', fontSize: 12.5 };
  const btnP: React.CSSProperties = { ...btn, background: 'var(--accent,#8b93ff)', color: '#fff', border: 'none', fontWeight: 600 };

  if (!d) return <div className="muted">Cargando…</div>;
  const s = d.settings || {};
  const names = s.level_names || { l2: 'Supervisor N2', l1: 'Supervisor N1', vendedor: 'Vendedor' };
  const reps: any[] = d.reps || [];
  const apps: any[] = (d.applications || []).filter((a: any) => a.status === 'pending');
  const recruitLink = (typeof window !== 'undefined' ? window.location.origin : 'https://www.onyxtradinglive.com') + '/unete-ventas';
  const lvName = (l: string) => (l === 'l2' ? names.l2 : l === 'l1' ? names.l1 : names.vendedor);

  const subBtn = (id: any, label: string, n?: number) => (
    <button onClick={() => setSub(id)} style={{ ...btn, background: sub === id ? 'var(--accent,#8b93ff)' : btn.background, color: sub === id ? '#fff' : btn.color, border: sub === id ? 'none' : btn.border }}>{label}{n ? ` · ${n}` : ''}</button>
  );

  async function drop(targetParentId: string | null) {
    if (!dragId) return;
    if (targetParentId === dragId) { setDragId(''); return; }
    await act({ action: 'set_rep', rep_id: dragId, parent_id: targetParentId });
    setDragId('');
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>{ic('users-group', 22, 'var(--accent,#8b93ff)')} Red de ventas</h2>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: 12 }}>Reclutamiento:</span>
          <input readOnly value={recruitLink} style={{ ...inp, width: 230 }} />
          <button style={btn} onClick={() => { navigator.clipboard.writeText(recruitLink); setMsg('Enlace copiado ✓'); }}>{ic('copy', 15)}</button>
        </div>
      </div>

      {msg && <div style={{ border: '1px solid var(--accent,#8b93ff)', color: 'var(--accent,#8b93ff)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {subBtn('red', 'La red', reps.length)}
        {subBtn('desempeno', 'Desempeño')}
        {subBtn('solicitudes', 'Solicitudes', apps.length)}
        {subBtn('ajustes', 'Ajustes')}
        {subBtn('pagos', 'Pagos')}
      </div>

      {/* ===== LA RED (árbol con drag & drop) ===== */}
      {sub === 'red' && <div>
        {canManage && <div style={{ background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <b style={{ fontSize: 14 }}>Añadir representante manualmente</b>
          <CreateRep reps={reps} act={act} inp={inp} btnP={btnP} lvName={lvName} />
        </div>}

        {reps.length === 0 ? <div className="muted">Aún no hay representantes. Aprueba una solicitud o añade uno manualmente.</div> : <>
          <div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>{ic('drag-drop', 15)} Arrastra un vendedor y suéltalo sobre un supervisor para moverlo de rama.</div>
          {/* Zona: hacer tope (sin supervisor) */}
          {dragId && <div onDragOver={(e) => e.preventDefault()} onDrop={() => drop(null)}
            style={{ border: '1.5px dashed var(--accent,#8b93ff)', borderRadius: 10, padding: 10, textAlign: 'center', color: 'var(--accent,#8b93ff)', marginBottom: 10, fontSize: 12.5 }}>
            ⬆ Soltar aquí = quitar supervisor (dejar en el tope)
          </div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {(['l2', 'l1', 'vendedor'] as const).map((lvl) => {
              const group = reps.filter((r) => r.level === lvl);
              const c = LV[lvl];
              return (
                <div key={lvl}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: c.fg, fontWeight: 700, marginBottom: 8 }}>{lvName(lvl)} <span style={{ opacity: .55 }}>({group.length})</span></div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {group.map((r) => (
                      <RepCard key={r.id} r={r} c={c} names={names} reps={reps} act={act} canManage={canManage}
                        dragId={dragId} setDragId={setDragId} onDropOn={drop} inp={inp} btn={btn} btnP={btnP} lvName={lvName} />
                    ))}
                    {group.length === 0 && <div className="muted" style={{ fontSize: 12, padding: '6px 2px' }}>—</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </>}
      </div>}

      {/* ===== DESEMPEÑO ===== */}
      {sub === 'desempeno' && <SalesPerf canManage={canManage} names={names} />}

      {/* ===== SOLICITUDES ===== */}
      {sub === 'solicitudes' && <div>
        {apps.length === 0 && <div className="muted">No hay solicitudes pendientes.</div>}
        {apps.map((a) => <AppRow key={a.id} a={a} reps={reps} act={act} inp={inp} btn={btn} btnP={btnP} canManage={canManage} lvName={lvName} />)}
      </div>}

      {/* ===== AJUSTES ===== */}
      {sub === 'ajustes' && <SettingsBox s={s} names={names} act={act} inp={inp} btnP={btnP} canManage={canManage} />}

      {/* ===== PAGOS ===== */}
      {sub === 'pagos' && <div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Paga el saldo disponible (madurado). Stripe = automático · USDT/manual = marcas con referencia.</div>
        {reps.filter((r) => (r.balances?.available || 0) > 0).length === 0 && <div className="muted">Nadie tiene saldo disponible ahora mismo.</div>}
        {reps.filter((r) => (r.balances?.available || 0) > 0).map((r) => <PayRow key={r.id} r={r} act={act} inp={inp} btn={btn} btnP={btnP} canManage={canManage} />)}
      </div>}
    </div>
  );
}

// Icono de línea inline (moderno, sin dependencias). Set reducido.
function ic(name: string, size = 16, color = 'currentColor') {
  const p: Record<string, string> = {
    'users-group': 'M10 13a4 4 0 100-8 4 4 0 000 8zM2 21v-1a5 5 0 015-5h6a5 5 0 015 5v1M17 11a3 3 0 100-6M22 21v-1a4 4 0 00-3-3.8',
    'copy': 'M9 9h10v10H9zM5 15H4V5a1 1 0 011-1h10v1',
    'drag-drop': 'M8 6h.01M8 12h.01M8 18h.01M14 6h.01M14 12h.01M14 18h.01',
    'grip': 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
    'file': 'M14 3v5h5M8 3h6l5 5v11a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1z',
    'cash': 'M3 6h18v12H3zM12 15a3 3 0 100-6 3 3 0 000 6z',
    'pencil': 'M4 20h4L18 10l-4-4L4 16v4zM13 5l4 4',
    'plus': 'M12 5v14M5 12h14',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', flex: 'none' }}><path d={p[name] || ''} /></svg>;
}

function RepCard({ r, c, names, reps, act, canManage, dragId, setDragId, onDropOn, inp, btn, btnP, lvName }: any) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState(r.level);
  const [parent, setParent] = useState(r.parent_id || '');
  const [rate, setRate] = useState(r.rate_override ?? '');
  const [workEmail, setWorkEmail] = useState(r.work_email || '');
  const [assign, setAssign] = useState('');
  const dfl = r.level === 'vendedor'
    ? { can_trial: true, can_discount: true, can_clients: true, can_tickets: true, can_recruit: false, can_team: false }
    : { can_trial: true, can_discount: true, can_clients: true, can_tickets: true, can_recruit: true, can_team: true };
  const [perms, setPerms] = useState<any>(r.perms ? { ...dfl, ...r.perms } : { ...dfl });
  const [customPerms, setCustomPerms] = useState<boolean>(!!r.perms);
  const b = r.balances || {};
  const PERM_LABELS: [string, string][] = [['can_trial', 'Dar pruebas'], ['can_discount', 'Dar descuentos'], ['can_clients', 'Gestionar clientes'], ['can_tickets', 'Atender tickets'], ['can_recruit', 'Reclutar equipo'], ['can_team', 'Ver equipo']];
  const isDragging = dragId === r.id;
  return (
    <div
      draggable={canManage}
      onDragStart={() => setDragId(r.id)}
      onDragEnd={() => setDragId('')}
      onDragOver={(e) => { if (dragId && dragId !== r.id) e.preventDefault(); }}
      onDrop={() => onDropOn(r.id)}
      style={{ background: c.bg, border: `1px solid ${dragId && dragId !== r.id ? 'var(--accent,#8b93ff)' : c.bd}`, borderRadius: 12, padding: '10px 12px', opacity: isDragging ? .5 : 1, cursor: canManage ? 'grab' : 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {canManage && <span style={{ color: c.fg, cursor: 'grab' }}>{ic('grip', 16, c.fg)}</span>}
        <b style={{ color: c.fg, fontSize: 13.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.display_name || r.email || r.code}</b>
        {r.on_hold && <span title="pagos pausados" style={{ color: 'var(--amber,#f0b74e)', fontSize: 12 }}>⏸</span>}
      </div>
      <div style={{ fontSize: 11.5, color: c.fg, opacity: .85, marginTop: 3 }}>{r.clients} clientes · disp ${b.available || 0}</div>
      {r.email && <div style={{ fontSize: 10.5, color: 'var(--mut,#9aa6bd)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</div>}
      {canManage && <button onClick={() => setOpen(!open)} style={{ ...btn, marginTop: 8, padding: '4px 10px', fontSize: 11.5 }}>{open ? 'Cerrar' : 'Editar'}</button>}
      {open && canManage && <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
        <select value={level} onChange={(e) => setLevel(e.target.value)} style={inp}><option value="vendedor">{lvName('vendedor')}</option><option value="l1">{lvName('l1')}</option><option value="l2">{lvName('l2')}</option></select>
        <select value={parent} onChange={(e) => setParent(e.target.value)} style={inp}><option value="">— sin supervisor —</option>{reps.filter((x: any) => x.id !== r.id && x.level !== 'vendedor').map((x: any) => <option key={x.id} value={x.id}>{x.display_name || x.email}</option>)}</select>
        <input type="number" placeholder="% propio (auto)" value={rate} onChange={(e) => setRate(e.target.value)} style={inp} />
        <input placeholder="correo de trabajo (ej. juan@onyxtradinglive.com)" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} style={inp} />
        <button style={btnP} onClick={() => act({ action: 'set_rep', rep_id: r.id, level, parent_id: parent || null, rate_override: rate, work_email: workEmail })}>Guardar</button>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button style={{ ...btn, flex: 1 }} onClick={() => act({ action: 'set_rep', rep_id: r.id, on_hold: !r.on_hold })}>{r.on_hold ? '▶ Reanudar' : '⏸ Pausar'}</button>
          <button style={{ ...btn, flex: 1 }} onClick={() => act({ action: 'set_rep', rep_id: r.id, status: r.status === 'active' ? 'paused' : 'active' })}>{r.status === 'active' ? 'Desactivar' : 'Activar'}</button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input placeholder="asignar cliente (correo)" value={assign} onChange={(e) => setAssign(e.target.value)} style={{ ...inp, flex: 1 }} />
          <button style={btn} onClick={() => assign && act({ action: 'assign_client', rep_id: r.id, email: assign })}>+</button>
        </div>
        {/* Permisos del representante */}
        <div style={{ borderTop: '1px solid var(--line,#2a3350)', paddingTop: 8, marginTop: 2 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer', color: 'var(--tx,#e8ecf5)' }}>
            <input type="checkbox" checked={customPerms} onChange={(e) => setCustomPerms(e.target.checked)} style={{ width: 15, height: 15, flex: 'none', margin: 0 }} />
            <span>Permisos personalizados (si no, hereda del nivel)</span>
          </label>
          {customPerms && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6 }}>
            {PERM_LABELS.map(([k, lab]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--mut,#9aa6bd)' }}>
                <input type="checkbox" checked={!!perms[k]} onChange={(e) => setPerms((p: any) => ({ ...p, [k]: e.target.checked }))} style={{ width: 14, height: 14, flex: 'none', margin: 0 }} />
                <span>{lab}</span>
              </label>
            ))}
          </div>}
          <button style={{ ...btnP, marginTop: 8, width: '100%', padding: '5px' }} onClick={() => act({ action: 'set_perms', rep_id: r.id, perms: customPerms ? perms : null })}>Guardar permisos</button>
        </div>
      </div>}
    </div>
  );
}

function CreateRep({ reps, act, inp, btnP, lvName }: any) {
  const [email, setEmail] = useState(''); const [level, setLevel] = useState('vendedor'); const [parent, setParent] = useState('');
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <input placeholder="correo (ya con cuenta en la app)" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inp, minWidth: 240 }} />
      <select value={level} onChange={(e) => setLevel(e.target.value)} style={inp}><option value="vendedor">{lvName('vendedor')}</option><option value="l1">{lvName('l1')}</option><option value="l2">{lvName('l2')}</option></select>
      <select value={parent} onChange={(e) => setParent(e.target.value)} style={inp}><option value="">sin supervisor</option>{reps.filter((r: any) => r.level !== 'vendedor').map((r: any) => <option key={r.id} value={r.id}>{r.display_name || r.email}</option>)}</select>
      <button style={btnP} onClick={() => email && act({ action: 'create_rep', email, level, parent_id: parent || null })}>Añadir</button>
    </div>
  );
}

function AppRow({ a, reps, act, inp, btn, btnP, canManage, lvName }: any) {
  const [level, setLevel] = useState(a.desired_role === 'supervisor' ? 'l1' : 'vendedor');
  const [parent, setParent] = useState('');
  return (
    <div style={{ background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div><b>{a.name}</b> <span className="muted" style={{ fontSize: 12 }}>· {a.email} · {a.country || '—'} · pide: {a.desired_role}</span></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {a.resume_signed ? <a href={a.resume_signed} target="_blank" rel="noopener" style={{ ...btn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>{ic('file', 14)} Ver CV</a> : <span className="muted" style={{ fontSize: 11 }}>sin CV</span>}
          <span className="muted" style={{ fontSize: 11 }}>{new Date(a.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      {(a.experience || a.audience || a.note) && <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{[a.experience, a.audience, a.note].filter(Boolean).join(' · ')}</div>}
      {canManage && <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={level} onChange={(e) => setLevel(e.target.value)} style={inp}><option value="vendedor">{lvName('vendedor')}</option><option value="l1">{lvName('l1')}</option><option value="l2">{lvName('l2')}</option></select>
        <select value={parent} onChange={(e) => setParent(e.target.value)} style={inp}><option value="">Sin supervisor</option>{reps.filter((r: any) => r.level !== 'vendedor').map((r: any) => <option key={r.id} value={r.id}>{r.display_name || r.email}</option>)}</select>
        <button style={btnP} onClick={() => act({ action: 'approve', app_id: a.id, email: a.email, level, parent_id: parent || null, display_name: a.name })}>Aprobar</button>
        <button style={btn} onClick={() => act({ action: 'reject', app_id: a.id })}>Rechazar</button>
      </div>}
    </div>
  );
}

function PayRow({ r, act, inp, btn, btnP, canManage }: any) {
  const [ref, setRef] = useState('');
  const b = r.balances || {};
  return (
    <div style={{ background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div><b>{r.display_name || r.email}</b> <span className="muted" style={{ fontSize: 12 }}>· disponible <b style={{ color: 'var(--green,#5ed6a0)' }}>${b.available}</b> · {r.payout_method || 'stripe'}</span></div>
        {canManage && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={btnP} onClick={() => act({ action: 'pay_stripe', rep_id: r.id })}>Pagar por Stripe</button>
          <input placeholder="txid (USDT)" value={ref} onChange={(e) => setRef(e.target.value)} style={{ ...inp, width: 150 }} />
          <button style={btn} onClick={() => act({ action: 'pay_manual', rep_id: r.id, method: 'usdt', ref })}>Marcar pagado</button>
        </div>}
      </div>
    </div>
  );
}

function SettingsBox({ s, names, act, inp, btnP, canManage }: any) {
  const [f, setF] = useState({ ...s, level_names: names });
  useEffect(() => { setF({ ...s, level_names: names }); }, [s]);
  const u = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const un = (k: string, v: any) => setF((x: any) => ({ ...x, level_names: { ...x.level_names, [k]: v } }));
  const uscope = (k: string, v: any) => setF((x: any) => ({ ...x, commission_scope: { ...(x.commission_scope || {}), [k]: v } }));
  const uth = (k: string, v: any) => setF((x: any) => ({ ...x, tier_thresholds: { ...(x.tier_thresholds || {}), [k]: Number(v) } }));
  const urev = (k: string, v: any) => setF((x: any) => ({ ...x, review: { ...(x.review || {}), [k]: v } }));
  const scope = f.commission_scope || {};
  const th = f.tier_thresholds || { star: 75, risk: 45 };
  const rev = f.review || { enabled: true, after_days: 20, email: false };
  const scopeTog = (k: string, label: string, hint?: string) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, cursor: 'pointer', color: 'var(--tx,#e8ecf5)', padding: '2px 0' }}>
      <input type="checkbox" checked={!!scope[k]} onChange={(e) => uscope(k, e.target.checked)} style={{ width: 16, height: 16, flex: 'none', margin: 0 }} />
      <span>{label}{hint && <span className="muted" style={{ fontSize: 11.5 }}> · {hint}</span>}</span>
    </label>
  );
  const card: React.CSSProperties = { background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 12, padding: 16, marginBottom: 12 };
  const num = (k: string, label: string, suf = '') => (
    <label style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', display: 'block' }}>{label}<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}><input type="number" value={f[k] ?? 0} onChange={(e) => u(k, Number(e.target.value))} style={{ ...inp, width: 90 }} />{suf && <span className="muted">{suf}</span>}</div></label>
  );
  const tog = (k: string, label: string) => (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, fontSize: 13.5, cursor: 'pointer', color: 'var(--tx,#e8ecf5)', padding: '2px 0' }}>
      <input type="checkbox" checked={!!f[k]} onChange={(e) => u(k, e.target.checked)} style={{ width: 16, height: 16, flex: 'none', margin: 0 }} />
      <span>{label}</span>
    </label>
  );
  return (
    <div>
      <div style={card}>
        <b style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{ic('pencil', 15)} Nombres de las posiciones</b>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
          <label style={{ fontSize: 12.5, color: LV.l2.fg }}>Nivel 2 (arriba)<input value={f.level_names?.l2 || ''} onChange={(e) => un('l2', e.target.value)} placeholder="Director" style={{ ...inp, display: 'block', marginTop: 4, width: 160 }} /></label>
          <label style={{ fontSize: 12.5, color: LV.l1.fg }}>Nivel 1<input value={f.level_names?.l1 || ''} onChange={(e) => un('l1', e.target.value)} placeholder="Líder" style={{ ...inp, display: 'block', marginTop: 4, width: 160 }} /></label>
          <label style={{ fontSize: 12.5, color: LV.vendedor.fg }}>Vendedor<input value={f.level_names?.vendedor || ''} onChange={(e) => un('vendedor', e.target.value)} placeholder="Asesor" style={{ ...inp, display: 'block', marginTop: 4, width: 160 }} /></label>
        </div>
      </div>
      <div style={card}>
        <b>Comisiones (% del pago mensual)</b>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
          {num('direct_rate', 'Vendedor directo', '%')}
          {num('override1_rate', 'Override Nivel 1', '%')}
          {num('override2_rate', 'Override Nivel 2', '%')}
          {num('commission_months', 'Meses (0 = ∞)')}
        </div>
        {(() => {
          const dr = Number(f.direct_rate) || 0, o1 = Number(f.override1_rate) || 0, o2 = Number(f.override2_rate) || 0;
          const nm2 = f.level_names?.l2 || 'Director', nm1 = f.level_names?.l1 || 'Lead', nmv = f.level_names?.vendedor || 'Advisor';
          const m = (pct: number) => pct > 0 ? '$' + pct.toFixed(0) : '—';   // sobre $100
          const months = Number(f.commission_months) || 0;
          const th: React.CSSProperties = { textAlign: 'right', padding: '6px 8px', fontSize: 11.5, color: 'var(--mut,#9aa6bd)', fontWeight: 600, borderBottom: '1px solid var(--line,#2a3350)' };
          const td: React.CSSProperties = { textAlign: 'right', padding: '7px 8px', fontSize: 12.5, borderBottom: '1px solid var(--line,#2a3350)' };
          const first: React.CSSProperties = { ...td, textAlign: 'left', color: 'var(--tx,#e8ecf5)', fontWeight: 500 };
          const rows = [
            { who: nm2, adv: 0, lead: 0, dir: dr },   // Director cierra: cobra directo, nadie arriba
            { who: nm1, adv: 0, lead: dr, dir: o1 },   // Lead cierra: directo + Director (override1)
            { who: nmv, adv: dr, lead: o1, dir: o2 },  // Advisor cierra: cadena completa
          ];
          return (
            <div style={{ marginTop: 14, background: 'var(--bg,#0e1220)', border: '1px solid var(--line,#2a3350)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', lineHeight: 1.55, marginBottom: 10 }}>
                <b style={{ color: 'var(--tx,#e8ecf5)' }}>Reparto por venta</b> · el % lo gana <b>quien cierra</b> (su enlace); los overrides son para quienes están arriba. Ejemplo con un cliente de <b>$100/mes</b>:
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 380 }}>
                  <thead><tr>
                    <th style={{ ...th, textAlign: 'left' }}>Quién cierra</th>
                    <th style={th}>{nmv}</th><th style={th}>{nm1}</th><th style={th}>{nm2}</th><th style={{ ...th, color: 'var(--tx,#e8ecf5)' }}>Total</th>
                  </tr></thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td style={first}>{r.who}</td>
                        <td style={{ ...td, color: r.adv ? '#5ed6a0' : 'var(--mut,#9aa6bd)' }}>{m(r.adv)}</td>
                        <td style={{ ...td, color: r.lead ? '#5ed6a0' : 'var(--mut,#9aa6bd)' }}>{m(r.lead)}</td>
                        <td style={{ ...td, color: r.dir ? '#e5b567' : 'var(--mut,#9aa6bd)' }}>{m(r.dir)}</td>
                        <td style={{ ...td, fontWeight: 700, color: 'var(--tx,#e8ecf5)' }}>${(r.adv + r.lead + r.dir).toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', marginTop: 10 }}>Se repite {months === 0 ? 'cada mes que el cliente siga pagando (Meses = ∞)' : `durante los primeros ${months} meses de cada cliente`}. Los valores cambian solos si editas los % de arriba.</div>
            </div>
          );
        })()}
      </div>
      <div style={card}>
        <b>Topes, pagos y frenos</b>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
          {num('trial_max_days', 'Máx. días de prueba')}
          {num('discount_max_pct', 'Máx. descuento', '%')}
          {num('hold_days', 'Retención (días)')}
          {num('min_payout', 'Mínimo para pagar', '$')}
        </div>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line,#2a3350)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx,#e8ecf5)' }}>Candados anti-abuso</div>
          <div style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)', margin: '3px 0 10px', lineHeight: 1.5 }}>
            Evita que un vendedor deje a un cliente gratis para siempre o inunde de cupones. <b>0 = sin límite.</b> Se aplican en el servidor, no solo en la pantalla.
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {num('trial_max_per_client', 'Máx. pruebas por cliente')}
            {num('trial_max_total_days', 'Máx. días gratis por cliente')}
            {num('trial_daily_cap', 'Máx. pruebas por día (vendedor)')}
            {num('discount_daily_cap', 'Máx. cupones por día (vendedor)')}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 6, marginTop: 14, maxWidth: 460 }}>
          {tog('enabled', 'Programa activo')}
          {tog('auto_payout', 'Pago automático cuando el saldo madura')}
          {tog('review_before_pay', 'Freno global: revisar antes de pagar')}
          {tog('allow_recruit', 'Los supervisores pueden reclutar su equipo')}
        </div>
      </div>
      <div style={card}>
        <b>Sobre qué servicios se paga comisión</b>
        <div style={{ display: 'grid', gap: 6, marginTop: 10, maxWidth: 520 }}>
          {scopeTog('subscriptions', 'Suscripciones y planes', 'recomendado')}
          {scopeTog('addons', 'Add-ons y cuentas extra')}
          {scopeTog('guardian', 'Onyx Guardian')}
          {scopeTog('academy', 'Academia', 'ya paga a los mentores')}
          {scopeTog('botlab', 'Bot Lab', 'ya paga a los creadores')}
          {scopeTog('copy', 'Comisiones de Copy')}
        </div>
      </div>
      <div style={card}>
        <b>Comisión por línea (opcional)</b>
        <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
          Academia y Bot Lab <b>ya pagan</b> al mentor/creador. Si activas su comisión de ventas, pon aquí un <b>% propio más bajo</b> (sale de la parte de Onyx) para no doblar el pago. En blanco = usa el % global de arriba.
        </div>
        {(() => {
          const lr = f.line_rates || {};
          const ulr = (line: string, slot: string, v: string) => setF((x: any) => ({ ...x, line_rates: { ...(x.line_rates || {}), [line]: { ...((x.line_rates || {})[line] || {}), [slot]: v === '' ? null : Number(v) } } }));
          const val = (line: string, slot: string) => { const v = (lr as any)[line]?.[slot]; return v == null ? '' : v; };
          const inpS: React.CSSProperties = { ...inp, width: 72, textAlign: 'right' };
          const lines: [string, string][] = [['academy', 'Academia'], ['botlab', 'Bot Lab'], ['copy', 'Copy']];
          const gl = { direct: f.direct_rate, override1: f.override1_rate, override2: f.override2_rate };
          return (
            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table style={{ borderCollapse: 'collapse', minWidth: 380 }}>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 11.5, color: 'var(--mut,#9aa6bd)' }}>Línea</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: 11.5, color: 'var(--mut,#9aa6bd)' }}>Directo %</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: 11.5, color: 'var(--mut,#9aa6bd)' }}>Ov. 1 %</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: 11.5, color: 'var(--mut,#9aa6bd)' }}>Ov. 2 %</th>
                </tr></thead>
                <tbody>
                  {lines.map(([k, label]) => (
                    <tr key={k}>
                      <td style={{ padding: '5px 8px', fontSize: 13, color: 'var(--tx,#e8ecf5)' }}>{label}</td>
                      {(['direct', 'override1', 'override2'] as const).map((slot) => (
                        <td key={slot} style={{ padding: '5px 8px', textAlign: 'right' }}>
                          <input type="number" value={val(k, slot)} onChange={(e) => ulr(k, slot, e.target.value)} placeholder={String((gl as any)[slot] ?? 0)} style={inpS} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
        <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>Recuerda activar la línea arriba para que se pague; aquí solo defines el %.</div>
      </div>
      <div style={card}>
        <b>Umbrales del plan de manejo (puntaje 0-100)</b>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10, alignItems: 'flex-end' }}>
          <label style={{ fontSize: 12.5, color: '#e5b567' }}>Estrella ≥<input type="number" value={th.star} onChange={(e) => uth('star', e.target.value)} style={{ ...inp, display: 'block', marginTop: 4, width: 90 }} /></label>
          <label style={{ fontSize: 12.5, color: '#f0736f' }}>En riesgo &lt;<input type="number" value={th.risk} onChange={(e) => uth('risk', e.target.value)} style={{ ...inp, display: 'block', marginTop: 4, width: 90 }} /></label>
          <span className="muted" style={{ fontSize: 12 }}>Entre ambos = Sólido.</span>
        </div>
      </div>
      <div style={card}>
        <b>Criterios de evaluación 360</b>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Uno por línea. Se usan en las evaluaciones supervisor↔vendedor.</div>
        <textarea value={(f.eval_criteria || []).join('\n')} onChange={(e) => u('eval_criteria', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 12))}
          style={{ ...inp, marginTop: 8, width: '100%', minHeight: 110, resize: 'vertical', fontFamily: 'inherit' }} />
      </div>
      <div style={card}>
        <b>Reseñas de clientes</b>
        <div style={{ display: 'grid', gap: 6, marginTop: 10, maxWidth: 520 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, cursor: 'pointer', color: 'var(--tx,#e8ecf5)' }}>
            <input type="checkbox" checked={!!rev.enabled} onChange={(e) => urev('enabled', e.target.checked)} style={{ width: 16, height: 16, flex: 'none', margin: 0 }} />
            <span>Pedir reseña al cliente automáticamente</span>
          </label>
          <label style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)' }}>Pedirla después de<input type="number" value={rev.after_days} onChange={(e) => urev('after_days', Number(e.target.value))} style={{ ...inp, width: 90, margin: '0 8px' }} />días de ser cliente</label>
        </div>
      </div>
      {canManage && <button style={btnP} onClick={() => act({ action: 'save_settings', settings: f })}>Guardar ajustes</button>}
    </div>
  );
}
