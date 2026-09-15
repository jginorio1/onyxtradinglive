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
  const [sub, setSub] = useState<'solicitudes' | 'red' | 'desempeno' | 'metas' | 'crecimiento' | 'kit' | 'ajustes' | 'pagos'>('red');
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
        <h2 style={{ margin: 0, fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>{ic('users-group', 22, 'var(--accent,#8b93ff)')} Red de ventas<Hint text="Tu equipo de comisionistas en 3 niveles (Advisor, Lead, Director). Cada pestaña de arriba controla una parte: La red = el árbol, Desempeño = puntajes, Metas = objetivos, Crecimiento = embudo y leads, Kit = materiales, Solicitudes = quienes aplican, Ajustes = todas las reglas, Pagos = pagarles." /></h2>
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
        {subBtn('metas', 'Metas')}
        {subBtn('crecimiento', 'Crecimiento')}
        {subBtn('kit', 'Kit')}
        {subBtn('solicitudes', 'Solicitudes', apps.length)}
        {subBtn('ajustes', 'Ajustes')}
        {subBtn('pagos', 'Pagos')}
      </div>

      {/* ===== LA RED (árbol con drag & drop) ===== */}
      {sub === 'red' && <div>
        {canManage && <div style={{ background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <b style={{ fontSize: 14 }}>Añadir representante manualmente<Hint text="Da de alta a un vendedor por su correo (debe tener cuenta en la app). Eliges su nivel y quién es su supervisor. También puedes arrastrar tarjetas para moverlo de rama, o darle de alta aprobando una Solicitud." /></b>
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
      {sub === 'desempeno' && <div>
        <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)', marginBottom: 8, display: 'flex', alignItems: 'center' }}>Puntaje y calificación de cada vendedor<Hint text="Tablero de rendimiento del equipo. Cada vendedor tiene un puntaje (0-100) que mezcla reseñas de clientes, conversión, actividad, atención y retención, y cae en Estrella / Sólido / En riesgo. Aquí ves reseñas, evaluaciones 360 y consejos de la IA." /></div>
        <SalesPerf canManage={canManage} names={names} />
      </div>}

      {/* ===== SOLICITUDES ===== */}
      {sub === 'solicitudes' && <div>
        <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)', marginBottom: 8, display: 'flex', alignItems: 'center' }}>Personas que aplicaron para vender<Hint text="Quienes se postularon desde la página pública de reclutamiento. Revisa su CV, elige nivel y supervisor, y Aprueba (queda de alta como vendedor) o Rechaza." /></div>
        {apps.length === 0 && <div className="muted">No hay solicitudes pendientes.</div>}
        {apps.map((a) => <AppRow key={a.id} a={a} reps={reps} act={act} inp={inp} btn={btn} btnP={btnP} canManage={canManage} lvName={lvName} />)}
      </div>}

      {/* ===== METAS ===== */}
      {sub === 'metas' && <MetasBox act={act} inp={inp} btn={btn} btnP={btnP} canManage={canManage} lvName={lvName} LV={LV} />}

      {/* ===== CRECIMIENTO ===== */}
      {sub === 'crecimiento' && <CrecimientoBox inp={inp} btn={btn} btnP={btnP} canManage={canManage} lvName={lvName} />}

      {/* ===== KIT ===== */}
      {sub === 'kit' && <KitBox inp={inp} btn={btn} btnP={btnP} canManage={canManage} />}

      {/* ===== AJUSTES ===== */}
      {sub === 'ajustes' && <SettingsBox s={s} names={names} act={act} inp={inp} btnP={btnP} canManage={canManage} />}

      {/* ===== PAGOS ===== */}
      {sub === 'pagos' && <div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center' }}>Paga el saldo disponible (madurado). Stripe = automático · USDT/manual = marcas con referencia.<Hint text="Solo aparecen aquí los vendedores con saldo DISPONIBLE (ya maduró y pasó la retención). Con Stripe el dinero sale solo al conectar su cuenta; con USDT/manual pagas fuera del sistema y marcas la referencia. Si tienes el pago automático activo, esto se hace solo." /></div>
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

// Icono "?" con explicación en un globo (clic para abrir/cerrar; title como respaldo).
function Hint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', marginLeft: 5 }}>
      <button type="button" title={text} aria-label="Ayuda"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid var(--line,#3a4363)', background: 'var(--card,#1b2338)', color: 'var(--mut,#9aa6bd)', fontSize: 10.5, lineHeight: '14px', cursor: 'pointer', padding: 0, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>?</button>
      {open && <span style={{ position: 'absolute', bottom: '135%', left: '50%', transform: 'translateX(-50%)', width: 250, maxWidth: '70vw', background: 'var(--panel,#161c2e)', border: '1px solid var(--accent,#8b93ff)', borderRadius: 10, padding: '9px 11px', fontSize: 12, color: 'var(--tx,#e8ecf5)', lineHeight: 1.5, zIndex: 80, boxShadow: '0 8px 30px rgba(0,0,0,.45)', fontWeight: 400, whiteSpace: 'normal', textAlign: 'left' }}>{text}</span>}
    </span>
  );
}

// ===== KIT: gestión de materiales de venta =====
function KitBox({ inp, btn, btnP, canManage }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ed, setEd] = useState<any>(null);   // asset en edición (o nuevo)
  async function post(body: any) { const r = await fetch('/api/admin/sales', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return r.json(); }
  async function load() { setBusy(true); try { const j = await post({ action: 'assets_list' }); setItems(j.assets || []); } catch {} setBusy(false); }
  useEffect(() => { load(); }, []);
  const card: React.CSSProperties = { background: 'var(--panel,#161c2e)', border: '1px solid var(--line,#2a3350)', borderRadius: 14, padding: 16, marginBottom: 12 };
  const blank = { kind: 'script', title: '', body: '', url: '', lang: 'es', sort: 0, active: true };
  if (busy) return <div className="muted">Cargando kit…</div>;
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)', marginBottom: 10, display: 'flex', alignItems: 'center' }}>Materiales para que tu equipo venda mejor<Hint text="Guiones, plantillas de WhatsApp, banners, PDFs o videos que creas aquí y aparecen en la pestaña 'Kit' del panel de cada vendedor (con botón de copiar/abrir). Elige idioma y si está activo (visible) o no." /></div>
      {canManage && <button style={{ ...btnP, marginBottom: 12 }} onClick={() => setEd({ ...blank })}>+ Nuevo material</button>}
      {ed && <div style={card}>
        <b>{ed.id ? 'Editar material' : 'Nuevo material'}</b>
        <div style={{ display: 'grid', gap: 8, marginTop: 10, maxWidth: 560 }}>
          <input value={ed.title} onChange={(e) => setEd({ ...ed, title: e.target.value })} placeholder="Título" style={inp} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={ed.kind} onChange={(e) => setEd({ ...ed, kind: e.target.value })} style={inp}>
              <option value="script">Guion / plantilla</option><option value="link">Enlace</option><option value="image">Imagen</option><option value="pdf">PDF</option><option value="video">Video</option>
            </select>
            <select value={ed.lang} onChange={(e) => setEd({ ...ed, lang: e.target.value })} style={inp}><option value="es">Español</option><option value="en">English</option><option value="all">Ambos</option></select>
            <input type="number" value={ed.sort} onChange={(e) => setEd({ ...ed, sort: Number(e.target.value) })} placeholder="Orden" style={{ ...inp, width: 90 }} />
          </div>
          <textarea value={ed.body || ''} onChange={(e) => setEd({ ...ed, body: e.target.value })} placeholder="Texto (guion / plantilla)" style={{ ...inp, minHeight: 90, resize: 'vertical' }} />
          <input value={ed.url || ''} onChange={(e) => setEd({ ...ed, url: e.target.value })} placeholder="URL (enlace / imagen / pdf / video)" style={inp} />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--tx,#e8ecf5)' }}><input type="checkbox" checked={ed.active !== false} onChange={(e) => setEd({ ...ed, active: e.target.checked })} /> Activo (visible para vendedores)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnP} onClick={async () => { if (ed.title.trim()) { await post({ action: 'save_asset', asset: ed }); setEd(null); load(); } }}>Guardar</button>
            <button style={btn} onClick={() => setEd(null)}>Cancelar</button>
          </div>
        </div>
      </div>}
      {items.length === 0 && <div className="muted">Aún no hay materiales. Crea guiones, banners, PDFs o videos para el equipo.</div>}
      {items.map((a) => (
        <div key={a.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div><b style={{ color: 'var(--tx,#e8ecf5)' }}>{a.title}</b> <span className="muted" style={{ fontSize: 11.5 }}>· {a.kind} · {a.lang}{a.active === false ? ' · oculto' : ''}</span></div>
            {canManage && <div style={{ display: 'flex', gap: 6 }}>
              <button style={btn} onClick={() => setEd({ ...a })}>Editar</button>
              <button style={btn} onClick={async () => { await post({ action: 'del_asset', id: a.id }); load(); }}>Borrar</button>
            </div>}
          </div>
          {a.body && <div className="muted" style={{ fontSize: 12, marginTop: 6, whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden' }}>{a.body}</div>}
        </div>
      ))}
    </div>
  );
}

// ===== CRECIMIENTO: embudo + leads sin dueño + ascensos =====
function CrecimientoBox({ inp, btn, btnP, canManage, lvName }: any) {
  const [funnel, setFunnel] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState('');
  async function post(body: any) {
    const r = await fetch('/api/admin/sales', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  }
  async function load() {
    setBusy(true);
    try { const [f, l] = await Promise.all([post({ action: 'funnel' }), post({ action: 'leads' })]); setFunnel(f); setLeads(l.leads || []); } catch {}
    setBusy(false);
  }
  useEffect(() => { load(); }, []);
  if (busy) return <div className="muted">Cargando…</div>;
  const t = funnel?.totals || { clicks: 0, signups: 0, trials: 0, paid: 0 };
  const stage = (label: string, val: number, color: string) => (
    <div style={{ flex: 1, minWidth: 110, background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
      <div style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', marginTop: 2 }}>{label}</div>
    </div>
  );
  const card: React.CSSProperties = { background: 'var(--panel,#161c2e)', border: '1px solid var(--line,#2a3350)', borderRadius: 14, padding: 16, marginBottom: 14 };
  return (
    <div>
      {msg && <div style={{ border: '1px solid var(--accent,#8b93ff)', color: 'var(--accent,#8b93ff)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{msg}</div>}

      <div style={card}>
        <b>Embudo de conversión (global)<Hint text="El recorrido del cliente en 4 pasos: Clics en enlaces de vendedores → Registros → Pruebas dadas → Pagados. La caída entre pasos te dice dónde se pierde la gente. Abajo lo ves por cada vendedor para saber quién convierte de verdad." /></b>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
          {stage('Clics', t.clicks, 'var(--tx,#e8ecf5)')}<span className="muted">→</span>
          {stage('Registros', t.signups, '#8b93ff')}<span className="muted">→</span>
          {stage('Pruebas', t.trials, '#e5b567')}<span className="muted">→</span>
          {stage('Pagados', t.paid, '#5ed6a0')}
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Conversión registro→pagado: <b style={{ color: 'var(--tx,#e8ecf5)' }}>{t.signups > 0 ? Math.round((t.paid / t.signups) * 100) : 0}%</b></div>
      </div>

      <div style={card}>
        <b>Por vendedor</b>
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460, fontSize: 13 }}>
            <thead><tr style={{ color: 'var(--mut,#9aa6bd)', fontSize: 11.5, textAlign: 'right' }}>
              <th style={{ padding: '6px', textAlign: 'left' }}>Vendedor</th><th style={{ padding: '6px' }}>Clics</th><th style={{ padding: '6px' }}>Registros</th><th style={{ padding: '6px' }}>Pruebas</th><th style={{ padding: '6px' }}>Pagados</th><th style={{ padding: '6px' }}>Conv.</th>
            </tr></thead>
            <tbody>
              {(funnel?.rows || []).map((r: any) => (
                <tr key={r.rep_id} style={{ borderTop: '1px solid var(--line,#2a3350)' }}>
                  <td style={{ padding: '7px 6px', color: 'var(--tx,#e8ecf5)' }}>{r.name} <span className="muted" style={{ fontSize: 11 }}>· {lvName(r.level)}</span></td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: 'var(--mut,#9aa6bd)' }}>{r.clicks}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: '#8b93ff' }}>{r.signups}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: '#e5b567' }}>{r.trials}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: '#5ed6a0' }}>{r.paid}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: 700, color: 'var(--tx,#e8ecf5)' }}>{r.conv}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <b>Leads sin dueño ({leads.length})<Hint text="Usuarios registrados que NO llegaron por el enlace de ningún vendedor, así que no tienen comisionista asignado. 'Repartir ahora' los distribuye entre los vendedores (el de menos clientes primero). 'Ascender ahora' revisa quién cumple umbral y sube de nivel." /></b>
          {canManage && <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnP} onClick={async () => { const j = await post({ action: 'assign_leads' }); setMsg(`Repartidos ${j.assigned || 0} leads ✓`); load(); }}>Repartir ahora</button>
            <button style={btn} onClick={async () => { const j = await post({ action: 'promote_now' }); setMsg(`Ascendidos ${j.promoted || 0} ✓`); load(); }}>Ascender ahora</button>
          </div>}
        </div>
        <div className="muted" style={{ fontSize: 12, margin: '4px 0 10px' }}>Usuarios registrados sin vendedor asignado. «Repartir» los balancea entre los vendedores (menos cargados primero).</div>
        {!leads.length ? <div className="muted">Todos los usuarios ya tienen vendedor. 🎉</div> :
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {leads.slice(0, 50).map((l: any) => (
                  <tr key={l.user_id} style={{ borderTop: '1px solid var(--line,#2a3350)' }}>
                    <td style={{ padding: '7px 6px', color: 'var(--tx,#e8ecf5)' }}>{l.email || l.name || l.user_id.slice(0, 8)}</td>
                    <td style={{ padding: '7px 6px', color: 'var(--mut,#9aa6bd)' }}>{l.plan}</td>
                    <td style={{ padding: '7px 6px', color: 'var(--mut,#9aa6bd)', fontSize: 12, textAlign: 'right' }}>{l.since ? new Date(l.since).toLocaleDateString() : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {leads.length > 50 && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>… y {leads.length - 50} más.</div>}
          </div>}
      </div>
    </div>
  );
}

// ===== METAS: progreso + editor por vendedor =====
function MetasBox({ inp, btn, btnP, canManage, lvName, LV }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [period, setPeriod] = useState('');
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState('');
  async function post(body: any) {
    const r = await fetch('/api/admin/sales', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  }
  async function load() {
    setBusy(true);
    try { const j = await post({ action: 'goals' }); setRows(j.rows || []); setPeriod(j.period || ''); } catch {}
    setBusy(false);
  }
  useEffect(() => { load(); }, []);
  if (busy) return <div className="muted">Cargando metas…</div>;
  return (
    <div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}><span>Metas del mes <b style={{ color: 'var(--tx,#e8ecf5)' }}>{period}</b>. En blanco = usa la meta global (Ajustes). El bono se paga solo como comisión al cumplir.</span><Hint text="El objetivo mensual de cada vendedor y su avance en vivo (clientes nuevos y comisión generada). Fija una meta propia a alguien o deja los campos en blanco para usar la meta global de Ajustes. Al cumplir, el bono se acredita solo." /></div>
      {msg && <div style={{ border: '1px solid var(--accent,#8b93ff)', color: 'var(--accent,#8b93ff)', borderRadius: 10, padding: '7px 12px', marginBottom: 10, fontSize: 13 }}>{msg}</div>}
      {!rows.length && <div className="muted">No hay vendedores activos.</div>}
      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map((r) => <RepGoalRow key={r.rep_id} r={r} period={period} lvName={lvName} LV={LV} inp={inp} btn={btn} btnP={btnP} canManage={canManage} post={post} onSaved={(m: string) => { setMsg(m); load(); }} />)}
      </div>
    </div>
  );
}

function RepGoalRow({ r, period, lvName, LV, inp, btn, btnP, canManage, post, onSaved }: any) {
  const [tc, setTc] = useState(String(r.goal?.target_clients ?? ''));
  const [ta, setTa] = useState(String(r.goal?.target_amount ?? ''));
  const [bo, setBo] = useState(String(r.goal?.bonus_amount ?? ''));
  const p = r.progress || {};
  const c = (LV as any)[r.level] || (LV as any).vendedor;
  const bar = (cur: number, tgt: number) => {
    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    return <div style={{ height: 7, borderRadius: 5, background: 'var(--bg,#0e1220)', overflow: 'hidden', minWidth: 90, flex: 1 }}><div style={{ width: pct + '%', height: '100%', background: pct >= 100 ? 'var(--green,#5ed6a0)' : 'var(--accent,#8b93ff)' }} /></div>;
  };
  return (
    <div style={{ background: 'var(--card,#1b2338)', border: `1px solid ${c.bd}`, borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ color: c.fg, fontSize: 14 }}>{r.name}</b>
        <span className="muted" style={{ fontSize: 11.5 }}>· {lvName(r.level)}</span>
        {p.met && <span style={{ fontSize: 11.5, color: 'var(--green,#5ed6a0)', fontWeight: 700 }}>✓ cumplió</span>}
        {r.goal?.custom && <span style={{ fontSize: 11, color: '#e5b567' }}>meta propia</span>}
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', margin: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180 }}>
          <span className="muted" style={{ fontSize: 12 }}>Clientes {p.clients}/{p.target_clients || '—'}</span>{bar(p.clients || 0, p.target_clients || 0)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180 }}>
          <span className="muted" style={{ fontSize: 12 }}>Comisión ${p.amount}/${p.target_amount || '—'}</span>{bar(p.amount || 0, p.target_amount || 0)}
        </div>
      </div>
      {canManage && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--line,#2a3350)', paddingTop: 10 }}>
        <label style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)' }}>Clientes<input type="number" value={tc} onChange={(e) => setTc(e.target.value)} style={{ ...inp, width: 70, display: 'block', marginTop: 3 }} /></label>
        <label style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)' }}>Comisión $<input type="number" value={ta} onChange={(e) => setTa(e.target.value)} style={{ ...inp, width: 80, display: 'block', marginTop: 3 }} /></label>
        <label style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)' }}>Bono $<input type="number" value={bo} onChange={(e) => setBo(e.target.value)} style={{ ...inp, width: 80, display: 'block', marginTop: 3 }} /></label>
        <button style={{ ...btnP, alignSelf: 'flex-end' }} onClick={async () => { await post({ action: 'set_goal', rep_id: r.rep_id, period, target_clients: Number(tc) || 0, target_amount: Number(ta) || 0, bonus_amount: Number(bo) || 0 }); onSaved('Meta guardada ✓'); }}>Guardar meta</button>
        {r.goal?.custom && <button style={{ ...btn, alignSelf: 'flex-end' }} onClick={async () => { await post({ action: 'del_goal', rep_id: r.rep_id, period }); onSaved('Volvió a la meta global ✓'); }}>Usar global</button>}
      </div>}
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
  const num = (k: string, label: string, suf = '', hint = '') => (
    <label style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', display: 'block' }}><span>{label}{hint && <Hint text={hint} />}</span><div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}><input type="number" value={f[k] ?? 0} onChange={(e) => u(k, Number(e.target.value))} style={{ ...inp, width: 90 }} />{suf && <span className="muted">{suf}</span>}</div></label>
  );
  const tog = (k: string, label: string, hint = '') => (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, fontSize: 13.5, cursor: 'pointer', color: 'var(--tx,#e8ecf5)', padding: '2px 0' }}>
      <input type="checkbox" checked={!!f[k]} onChange={(e) => u(k, e.target.checked)} style={{ width: 16, height: 16, flex: 'none', margin: 0 }} />
      <span>{label}{hint && <Hint text={hint} />}</span>
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
        <b>Comisiones (% del pago mensual)<Hint text="El % que gana la red por cada pago del cliente. Directo = quien cerró la venta. Override 1 y 2 = los dos niveles arriba de él en el árbol. Se cobra cada mes que el cliente siga pagando." /></b>
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
          {num('trial_max_days', 'Máx. días de prueba', '', 'Cuántos días de acceso gratis puede dar un vendedor a un cliente en UNA prueba. Si pide más, el sistema lo recorta a este tope.')}
          {num('discount_max_pct', 'Máx. descuento', '%', 'El % de descuento máximo que un vendedor puede generar en un cupón. Aunque escriba más, se recorta a este valor.')}
          {num('hold_days', 'Retención (días)', '', 'Días que una comisión queda "madurando" antes de estar disponible para pagar. Protege ante reembolsos: si el cliente pide devolución en este plazo, la comisión se anula sin haberse pagado.')}
          {num('min_payout', 'Mínimo para pagar', '$', 'Saldo mínimo que un vendedor debe acumular para que el pago automático se dispare. Debajo de esto, el saldo se sigue juntando pero no se paga aún.')}
        </div>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line,#2a3350)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx,#e8ecf5)' }}>Candados anti-abuso</div>
          <div style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)', margin: '3px 0 10px', lineHeight: 1.5 }}>
            Evita que un vendedor deje a un cliente gratis para siempre o inunde de cupones. <b>0 = sin límite.</b> Se aplican en el servidor, no solo en la pantalla.
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {num('trial_max_per_client', 'Máx. pruebas por cliente', '', 'Cuántas veces (de cualquier vendedor) un mismo cliente puede recibir prueba gratis. Con 1, evita que le den prueba tras prueba y quede gratis para siempre. 0 = sin límite.')}
            {num('trial_max_total_days', 'Máx. días gratis por cliente', '', 'Tope de días gratis ACUMULADOS por cliente, sumando todas sus pruebas. Al llegar, no se le dan más; si pide más de los que quedan, se recorta. 0 = sin límite.')}
            {num('trial_daily_cap', 'Máx. pruebas por día (vendedor)', '', 'Cuántas pruebas puede dar UN vendedor en 24 horas. Frena que inunde de pruebas a muchos de golpe. 0 = sin límite.')}
            {num('discount_daily_cap', 'Máx. cupones por día (vendedor)', '', 'Cuántos cupones de descuento puede generar UN vendedor en 24 horas. 0 = sin límite.')}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 6, marginTop: 14, maxWidth: 460 }}>
          {tog('enabled', 'Programa activo', 'Interruptor maestro de toda la red de ventas. Apagado, no se acredita ninguna comisión ni se paga nada.')}
          {tog('auto_payout', 'Pago automático cuando el saldo madura', 'Si está activo, el sistema paga solo a cada vendedor cuando su saldo maduró y supera el mínimo. Apagado, tienes que pagar tú a mano en la pestaña Pagos.')}
          {tog('review_before_pay', 'Freno global: revisar antes de pagar', 'Pausa TODOS los pagos automáticos. Las comisiones se siguen acumulando, pero nadie cobra hasta que tú lo revises y pagues a mano. Útil si sospechas de algo.')}
          {tog('allow_recruit', 'Los supervisores pueden reclutar su equipo', 'Permite que Leads y Directores añadan/inviten vendedores a su propia rama. Apagado, solo tú (admin) puedes mover gente en la red.')}
        </div>
      </div>
      <div style={card}>
        <b>Permisos por nivel<Hint text="Define qué puede hacer cada posición (Advisor/Lead/Director) por defecto: dar pruebas, descuentos, gestionar clientes, atender tickets, reclutar y ver su equipo. Puedes anularlo persona por persona en su tarjeta." /></b>
        <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
          Lo que cada posición puede hacer por defecto. Puedes anularlo persona por persona en su tarjeta (La red → Editar → Permisos personalizados).
        </div>
        {(() => {
          const PD = f.perms_defaults || {};
          const DEF_ALL = { can_trial: true, can_discount: true, can_clients: true, can_tickets: true, can_recruit: true, can_team: true };
          const DEF_SELLER = { can_trial: true, can_discount: true, can_clients: true, can_tickets: true, can_recruit: false, can_team: false };
          const rowDef = (lv: string) => ({ ...(lv === 'vendedor' ? DEF_SELLER : DEF_ALL), ...((PD as any)[lv] || {}) });
          const setp = (lv: string, k: string, v: boolean) => setF((x: any) => ({ ...x, perms_defaults: { ...(x.perms_defaults || {}), [lv]: { ...rowDef(lv), [k]: v } } }));
          const PERMS: [string, string][] = [['can_trial', 'Dar pruebas'], ['can_discount', 'Dar descuentos'], ['can_clients', 'Gestionar clientes'], ['can_tickets', 'Atender tickets'], ['can_recruit', 'Reclutar equipo'], ['can_team', 'Ver equipo']];
          const cols: [string, string, string][] = [['vendedor', f.level_names?.vendedor || 'Advisor', LV.vendedor.fg], ['l1', f.level_names?.l1 || 'Lead', LV.l1.fg], ['l2', f.level_names?.l2 || 'Director', LV.l2.fg]];
          return (
            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table style={{ borderCollapse: 'collapse', minWidth: 420, width: '100%' }}>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 11.5, color: 'var(--mut,#9aa6bd)' }}>Permiso</th>
                  {cols.map(([lv, label, fg]) => <th key={lv} style={{ padding: '4px 8px', fontSize: 11.5, color: fg, fontWeight: 700 }}>{label}</th>)}
                </tr></thead>
                <tbody>
                  {PERMS.map(([k, label]) => (
                    <tr key={k} style={{ borderTop: '1px solid var(--line,#2a3350)' }}>
                      <td style={{ padding: '6px 8px', fontSize: 13, color: 'var(--tx,#e8ecf5)' }}>{label}</td>
                      {cols.map(([lv]) => (
                        <td key={lv} style={{ textAlign: 'center', padding: '6px 8px' }}>
                          <input type="checkbox" checked={!!(rowDef(lv) as any)[k]} onChange={(e) => setp(lv, k, e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
        <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>«Reclutar» y «Ver equipo» solo aplican a Lead/Director. Un vendedor con permiso personalizado ignora esta tabla.</div>
      </div>
      <div style={card}>
        <b>Sobre qué servicios se paga comisión<Hint text="Enciende las líneas de ingreso por las que SÍ se paga comisión de ventas. Academia y Bot Lab vienen apagadas porque ya pagan al mentor/creador; si las enciendes, usa la 'Comisión por línea' de abajo para no doblar el pago." /></b>
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
        <b>Comisión por línea (opcional)<Hint text="Un % propio (más bajo) solo para Academia, Bot Lab o Copy, que ya pagan al mentor/creador. Así el vendedor cobra un incentivo sin doblar el pago. En blanco = usa el % global de arriba. Recuerda encender la línea en 'Sobre qué servicios se paga comisión'." /></b>
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
        <b>Umbrales del plan de manejo (puntaje 0-100)<Hint text="El puntaje del vendedor (mezcla reseñas, conversión, actividad, atención y retención) lo clasifica en tres estados. Estrella = igual o mayor al primer número. En riesgo = menor al segundo. Entre ambos = Sólido." /></b>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10, alignItems: 'flex-end' }}>
          <label style={{ fontSize: 12.5, color: '#e5b567' }}>Estrella ≥<input type="number" value={th.star} onChange={(e) => uth('star', e.target.value)} style={{ ...inp, display: 'block', marginTop: 4, width: 90 }} /></label>
          <label style={{ fontSize: 12.5, color: '#f0736f' }}>En riesgo &lt;<input type="number" value={th.risk} onChange={(e) => uth('risk', e.target.value)} style={{ ...inp, display: 'block', marginTop: 4, width: 90 }} /></label>
          <span className="muted" style={{ fontSize: 12 }}>Entre ambos = Sólido.</span>
        </div>
      </div>
      <div style={card}>
        <b>Criterios de evaluación 360<Hint text="Los aspectos que se califican cuando un supervisor evalúa a su equipo y viceversa (comunicación, conocimiento, puntualidad, etc.). Uno por línea; puedes cambiarlos." /></b>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Uno por línea. Se usan en las evaluaciones supervisor↔vendedor.</div>
        <textarea value={(f.eval_criteria || []).join('\n')} onChange={(e) => u('eval_criteria', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 12))}
          style={{ ...inp, marginTop: 8, width: '100%', minHeight: 110, resize: 'vertical', fontFamily: 'inherit' }} />
      </div>
      <div style={card}>
        <b>Reseñas de clientes<Hint text="Pide automáticamente al cliente que califique a su vendedor después de X días de ser cliente. Las reseñas alimentan el puntaje del vendedor." /></b>
        <div style={{ display: 'grid', gap: 6, marginTop: 10, maxWidth: 520 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, cursor: 'pointer', color: 'var(--tx,#e8ecf5)' }}>
            <input type="checkbox" checked={!!rev.enabled} onChange={(e) => urev('enabled', e.target.checked)} style={{ width: 16, height: 16, flex: 'none', margin: 0 }} />
            <span>Pedir reseña al cliente automáticamente</span>
          </label>
          <label style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)' }}>Pedirla después de<input type="number" value={rev.after_days} onChange={(e) => urev('after_days', Number(e.target.value))} style={{ ...inp, width: 90, margin: '0 8px' }} />días de ser cliente</label>
        </div>
      </div>
      <div style={card}>
        <b>Metas por defecto (mensuales)</b>
        <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
          Se aplican a todos los vendedores salvo que fijes una meta propia en la pestaña «Metas». El bono se paga solo como comisión al cumplir.
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
          {num('goal_clients', 'Meta de clientes nuevos', '', 'Cuántos clientes nuevos (que pagaron) debe traer un vendedor al mes para cumplir su meta. 0 = no se mide por clientes.')}
          {num('goal_amount', 'Meta de comisión', '$', 'Cuánta comisión debe generar en el mes para cumplir. 0 = no se mide por dinero.')}
          {num('goal_bonus', 'Bono al cumplir', '$', 'Bono extra que se paga (como comisión) cuando el vendedor cumple su meta del mes. 0 = sin bono.')}
        </div>
      </div>
      <div style={card}>
        <b>Notificaciones al vendedor</b>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Avísale por app, correo y Telegram cuando pasa algo importante.</div>
        <div style={{ display: 'grid', gap: 6, marginTop: 10, maxWidth: 460 }}>
          {tog('notify_new_client', 'Cliente nuevo con su enlace', 'Avisa al vendedor cuando alguien se registra usando su enlace de invitación.')}
          {tog('notify_first_paid', 'Primer pago de un cliente', 'Avisa cuando uno de sus clientes hace su primer pago (empieza a generar comisión).')}
          {tog('notify_commission', 'Comisión ganada', 'Avisa cada vez que se le acredita una comisión.')}
          {tog('notify_payout', 'Pago enviado', 'Avisa cuando le pagas su saldo (por Stripe, USDT o manual).')}
        </div>
      </div>
      <div style={card}>
        <b>Ascensos y reparto automáticos</b>
        <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
          Reversible: puedes degradar a alguien a mano y apagar esto cuando quieras.
        </div>
        <div style={{ display: 'grid', gap: 6, marginTop: 10, maxWidth: 520 }}>
          {tog('auto_promote', 'Ascender de nivel automáticamente al llegar al umbral', 'Sube solo a un vendedor cuando alcanza los umbrales de abajo. El descenso NO es automático: lo haces tú a mano en la tarjeta de la persona. Apagado, no sube nadie solo.')}
          {tog('auto_assign_leads', 'Repartir leads sin dueño entre vendedores (round-robin)', 'Cuando alguien se registra SIN el enlace de un vendedor, el sistema lo asigna solo al vendedor con menos clientes. Apagado, esos leads quedan sin dueño hasta que los repartas a mano en Crecimiento.')}
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
          {num('promote_to_l1_clients', 'Advisor → Lead con … clientes activos', '', 'Cuántos clientes activos (pagando) debe tener un Advisor para subir solo a Lead. 0 = desactiva este ascenso.')}
          {num('promote_to_l2_team', 'Lead → Director con … en su equipo', '', 'Cuántas personas debe tener un Lead en su equipo para subir solo a Director. 0 = desactiva este ascenso.')}
        </div>
      </div>
      {canManage && <button style={btnP} onClick={() => act({ action: 'save_settings', settings: f })}>Guardar ajustes</button>}
    </div>
  );
}
