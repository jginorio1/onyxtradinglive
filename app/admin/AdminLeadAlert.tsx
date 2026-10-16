'use client';
import { mkL } from '@/lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';

// Aviso de consultas de clientes/leads. Ahora:
//  · Se puede ARRASTRAR a cualquier esquina (recuerda dónde la dejaste).
//  · Si hay varias, navegas con ‹ anterior / siguiente › sin cerrar.
//  · Puedes REASIGNAR la consulta a un compañero desde aquí mismo.
// Solo se muestra a empleados marcados como "Disponible".
export default function AdminLeadAlert({ available }: { available: boolean }) {
  const { lang } = useLang();
  const L = mkL(lang);
  const [leads, setLeads] = useState<any[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [min, setMin] = useState(false);
  const [idx, setIdx] = useState(0);            // cuál de las no vistas se muestra
  const [team, setTeam] = useState<any[]>([]);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Posición arrastrada (px desde la esquina). Null = esquina inferior derecha por defecto.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [desk, setDesk] = useState(false);   // PC (ancho ≥ 860px): pastilla un poco más grande
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  // Posición vertical (px desde arriba) de la pastilla minimizada en el borde
  // derecho. Null = centrada. Se arrastra arriba/abajo y se recuerda.
  const [pillY, setPillY] = useState<number | null>(null);
  const pillDrag = useRef<{ startY: number; baseY: number; moved: boolean } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width:860px)');
    const upd = () => setDesk(mq.matches);
    upd(); mq.addEventListener('change', upd); return () => mq.removeEventListener('change', upd);
  }, []);
  useEffect(() => { try { const y = localStorage.getItem('onyx_lead_pillY'); if (y != null) setPillY(parseInt(y, 10)); } catch {} }, []);

  useEffect(() => {
    try { setSeen(new Set(JSON.parse(localStorage.getItem('onyx_lead_seen') || '[]'))); } catch {}
    try { const p = JSON.parse(localStorage.getItem('onyx_lead_pos') || 'null'); if (p && typeof p.x === 'number') setPos(p); } catch {}
    const load = () => fetch('/api/admin/leads-alert').then((r) => r.json()).then((j) => setLeads(j.tickets || [])).catch(() => {});
    load(); const iv = setInterval(load, 20000); return () => clearInterval(iv);
  }, []);
  // Equipo (para reasignar). Se carga una vez.
  useEffect(() => { fetch('/api/admin/team').then((r) => r.json()).then((j) => setTeam((j.team || []).filter((m: any) => m.is_admin))).catch(() => {}); }, []);

  function markSeen(id: string) {
    setSeen((s) => { const n = new Set(s); n.add(id); try { localStorage.setItem('onyx_lead_seen', JSON.stringify([...n].slice(-200))); } catch {} return n; });
    setReassignOpen(false);
  }
  async function reassignTo(ticketId: string, assigneeId: string) {
    setBusy(true);
    try { await fetch('/api/admin/support', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket_id: ticketId, assignee_id: assigneeId }) }); } catch {}
    setBusy(false); markSeen(ticketId);   // ya no es "tuya pendiente"
  }

  const unseen = leads.filter((l) => !seen.has(l.id));
  // Mantener el índice dentro de rango cuando cambia la lista.
  const safeIdx = Math.min(idx, Math.max(0, unseen.length - 1));
  if (!available || !unseen.length) return null;
  const l = unseen[safeIdx];

  const catMap: any = { facturacion: L('Facturación', 'Billing'), conexion: L('Conexión', 'Connection'), instalacion: L('Instalación', 'Install'), guardian: 'Guardian', general: L('General', 'General') };
  const ago = (iso: string) => { const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000); if (m < 1) return L('ahora', 'now'); if (m < 60) return `${m} min`; return `${Math.floor(m / 60)} h`; };

  // Minimizado: pestañita pegada al borde DERECHO. Se ARRASTRA arriba/abajo por
  // todo el lado derecho para que no estorbe el chat; recuerda dónde la dejaste.
  // Un toque (sin arrastrar) la abre. En PC un poco más grande.
  const pillH = desk ? 48 : 40;   // alto aprox. para acotar el arrastre
  const pillTop = pillY != null
    ? Math.max(6, Math.min(pillY, (typeof window !== 'undefined' ? window.innerHeight : 800) - pillH - 6))
    : undefined;
  function pillDown(e: React.PointerEvent) {
    pillDrag.current = { startY: e.clientY, baseY: pillTop != null ? pillTop : (e.currentTarget as HTMLElement).getBoundingClientRect().top, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function pillMove(e: React.PointerEvent) {
    const d = pillDrag.current; if (!d) return;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > 4) d.moved = true;
    setPillY(d.baseY + dy);
  }
  function pillUp() {
    const d = pillDrag.current; pillDrag.current = null;
    if (!d) return;
    if (!d.moved) { setMin(false); return; }   // fue un toque → abrir
    try { if (pillY != null) localStorage.setItem('onyx_lead_pillY', String(pillY)); } catch {}
  }
  if (min) return (
    <div title={L('Consultas nuevas · arrastra para mover', 'New consultations · drag to move')}
      onPointerDown={pillDown} onPointerMove={pillMove} onPointerUp={pillUp}
      style={{ position: 'fixed', right: 0, ...(pillTop != null ? { top: pillTop } : { top: '50%', transform: 'translateY(-50%)' }), zIndex: 2000, background: 'var(--card)', border: '1px solid var(--line)', borderRight: 'none', borderRadius: `${desk ? 24 : 20}px 0 0 ${desk ? 24 : 20}px`, borderLeft: '4px solid #EF9F27', padding: desk ? '13px 16px 13px 14px' : '9px 12px 9px 10px', cursor: 'grab', touchAction: 'none', userSelect: 'none', display: 'flex', alignItems: 'center', gap: desk ? 9 : 7, boxShadow: '-6px 0 18px rgba(0,0,0,.25)' }}>
      <span style={{ fontSize: desk ? 21 : 17 }}><OnyxIcon emoji="💬" size={desk ? 19 : 15} /></span>
      <span style={{ background: 'var(--red)', color: '#fff', fontSize: desk ? 13 : 11, fontWeight: 700, padding: desk ? '2px 9px' : '1px 7px', borderRadius: 20 }}>{unseen.length}</span>
    </div>
  );

  // Arrastre: al soltar, guardamos la posición. Por defecto, CENTRADA a media
  // pantalla; una vez que la arrastras, recuerda dónde la dejaste.
  const W = 330;
  const style: any = pos
    ? { left: Math.max(6, Math.min(pos.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - W - 6)), top: Math.max(6, pos.y) }
    : { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' };
  function onDown(e: React.PointerEvent) {
    const el = (e.currentTarget.closest('[data-pill]') as HTMLElement); if (!el) return;
    const r = el.getBoundingClientRect(); drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setPos({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy });
  }
  function onUp() { if (drag.current) { drag.current = null; try { localStorage.setItem('onyx_lead_pos', JSON.stringify(pos)); } catch {} } }

  return (
    <>
    {/* Sin fondo oscuro: la tarjeta no debe tapar ni atenuar el chat de atrás. */}
    <div data-pill style={{ position: 'fixed', zIndex: 2000, width: W, maxWidth: '92vw', background: 'var(--card)', border: '1px solid var(--line)', borderLeft: '5px solid #EF9F27', borderRadius: 16, boxShadow: '0 20px 56px rgba(0,0,0,.5)', overflow: 'hidden', ...style }}>
      {/* Cabecera: agarra el ⠿ para mover; navega entre consultas; minimiza. */}
      <div className="row between" style={{ padding: '9px 12px', borderBottom: '1px solid var(--line)' }}>
        <span className="row" style={{ gap: 7, alignItems: 'center', minWidth: 0 }}>
          <span onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} title={L('Mover', 'Move')} style={{ cursor: 'grab', color: 'var(--mut)', display: 'inline-flex', touchAction: 'none' }}><OnyxIcon emoji="⠿" size={14} /></span>
          <b style={{ fontSize: 13.5 }}>{L('Nueva consulta', 'New consultation')}</b>
        </span>
        <span className="row" style={{ gap: 4, alignItems: 'center' }}>
          {unseen.length > 1 && (
            <span className="row" style={{ gap: 2, alignItems: 'center', border: '1px solid var(--line)', borderRadius: 999, padding: 2 }}>
              <button onClick={() => setIdx((i) => Math.max(0, (safeIdx) - 1))} disabled={safeIdx <= 0} title={L('Anterior', 'Previous')} style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'transparent', cursor: safeIdx <= 0 ? 'default' : 'pointer', color: safeIdx <= 0 ? 'var(--mut)' : 'var(--soft-brand)', opacity: safeIdx <= 0 ? .4 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>‹</button>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', minWidth: 30, textAlign: 'center' }}>{safeIdx + 1}/{unseen.length}</span>
              <button onClick={() => setIdx((i) => Math.min(unseen.length - 1, (safeIdx) + 1))} disabled={safeIdx >= unseen.length - 1} title={L('Siguiente', 'Next')} style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'transparent', cursor: safeIdx >= unseen.length - 1 ? 'default' : 'pointer', color: safeIdx >= unseen.length - 1 ? 'var(--mut)' : 'var(--soft-brand)', opacity: safeIdx >= unseen.length - 1 ? .4 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>›</button>
            </span>
          )}
          <button onClick={() => setMin(true)} title={L('Ocultar', 'Hide')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--mut)', padding: '0 4px' }}>—</button>
        </span>
      </div>

      <div style={{ padding: '12px 13px' }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <span className="pill" style={{ fontSize: 10.5, color: 'var(--soft-brand)', background: 'rgba(124,140,255,.15)' }}>Lead</span>
          {l.priority === 'high' && <span className="pill" style={{ fontSize: 10.5, color: 'var(--red)', background: 'rgba(255,107,125,.15)' }}>{L('Alta', 'High')}</span>}
          <span className="pill" style={{ fontSize: 10.5, color: 'var(--mut)', background: 'var(--bg2)' }}>{catMap[l.category] || l.category}</span>
        </div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 5 }}>{l.email || '—'} · {ago(l.created_at)}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px', maxHeight: 110, overflow: 'auto' }}>{l.message}</div>
        {l.aiReply && (
          <div style={{ marginTop: 8, background: 'rgba(52,226,160,.08)', border: '1px solid rgba(52,226,160,.35)', borderRadius: 10, padding: '9px 11px' }}>
            <div style={{ fontSize: 11.5, color: 'var(--soft-green)', fontWeight: 600, marginBottom: 3 }}><OnyxIcon emoji="🤖" size={15} /> {L('Onyx AI ya respondió', 'Onyx AI already replied')}</div>
            <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45, maxHeight: 66, overflow: 'hidden' }}>{l.aiReply}</div>
          </div>
        )}
        {/* Reasignar a un compañero (desde aquí mismo) */}
        {reassignOpen && (
          <div style={{ marginTop: 8, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: 8 }}>
            <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>{L('Reasignar a…', 'Reassign to…')}</div>
            {!team.length ? <div className="muted" style={{ fontSize: 12 }}>{L('No hay compañeros.', 'No teammates.')}</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 140, overflowY: 'auto' }}>
                {team.map((m) => (
                  <button key={m.id} disabled={busy} onClick={() => reassignTo(l.id, m.id)} style={{ textAlign: 'left', fontSize: 12.5, padding: '7px 9px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--tx)', cursor: 'pointer' }}>
                    {(m.email || '').split('@')[0]} {m.role ? <span className="muted" style={{ fontSize: 11 }}>· {m.role}</span> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="row" style={{ gap: 7, padding: '10px 13px', borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
        <a className="btn btn-primary" href={`/admin?ticket=${l.id}#soporte`} style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => markSeen(l.id)}>{L('Abrir', 'Open')}</a>
        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setReassignOpen((v) => !v)}>↪ {L('Reasignar', 'Reassign')}</button>
        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13, marginLeft: 'auto' }} onClick={() => markSeen(l.id)}>{L('Visto', 'Seen')}</button>
      </div>
    </div>
    </>
  );
}
