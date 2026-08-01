'use client';
import { mkL } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';

// Aviso sticky de consultas de clientes/leads: entra de derecha a izquierda,
// pegado al borde derecho y centrado vertical. Solo a empleados "Disponible".
export default function AdminLeadAlert({ available }: { available: boolean }) {
  const { lang } = useLang();
  const L = mkL(lang);
  const [leads, setLeads] = useState<any[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [min, setMin] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    try { setSeen(new Set(JSON.parse(localStorage.getItem('onyx_lead_seen') || '[]'))); } catch {}
    const load = () => fetch('/api/admin/leads-alert').then((r) => r.json()).then((j) => setLeads(j.tickets || [])).catch(() => {});
    load(); const iv = setInterval(load, 20000); return () => clearInterval(iv);
  }, []);

  function markSeen(id: string) {
    setSeen((s) => { const n = new Set(s); n.add(id); try { localStorage.setItem('onyx_lead_seen', JSON.stringify([...n].slice(-200))); } catch {} return n; });
  }
  const unseen = leads.filter((l) => !seen.has(l.id));
  if (!available || !unseen.length) return null;

  const l = unseen[0];
  const catMap: any = { facturacion: L('Facturación', 'Billing'), conexion: L('Conexión', 'Connection'), instalacion: L('Instalación', 'Install'), guardian: 'Guardian', general: L('General', 'General') };
  const ago = (iso: string) => { const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000); if (m < 1) return L('ahora', 'now'); if (m < 60) return `${m} min`; return `${Math.floor(m / 60)} h`; };

  // Minimizado: pestañita pegada al borde con contador.
  if (min) return (
    <button onClick={() => setMin(false)} title={L('Consultas nuevas', 'New consultations')}
      style={{ position: 'fixed', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 2000, background: 'var(--card)', border: '1px solid var(--line)', borderRight: 'none', borderRadius: '20px 0 0 20px', borderLeft: '4px solid #EF9F27', padding: '9px 12px 9px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '-6px 0 18px rgba(0,0,0,.25)' }}>
      <span style={{ fontSize: 17 }}>💬</span>
      <span style={{ background: 'var(--red)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20 }}>{unseen.length}</span>
    </button>
  );

  return (
    <>
      <style>{`@keyframes onyxSlideR{from{transform:translate(110%,-50%)}to{transform:translate(0,-50%)}}`}</style>
      <div style={{ position: 'fixed', right: 0, top: '50%', transform: 'translate(0,-50%)', zIndex: 2000, width: 340, maxWidth: '88vw', background: 'var(--card)', border: '1px solid var(--line)', borderRight: 'none', borderLeft: '5px solid #EF9F27', borderRadius: '16px 0 0 16px', boxShadow: '-14px 0 40px rgba(0,0,0,.4)', overflow: 'hidden', animation: 'onyxSlideR .35s ease' }}>
        <div className="row between" style={{ padding: '11px 14px', borderBottom: '1px solid var(--line)' }}>
          <b style={{ fontSize: 14 }}>💬 {L('Nueva consulta', 'New consultation')}</b>
          <span className="row" style={{ gap: 8, alignItems: 'center' }}>
            {unseen.length > 1 && <span className="pill" style={{ fontSize: 11, color: 'var(--amber)', background: 'rgba(255,192,77,.16)' }}>{unseen.length}</span>}
            <button onClick={() => setPinned((p) => !p)} title={L('Fijar', 'Pin')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, color: pinned ? 'var(--soft-brand)' : 'var(--mut)' }}>📌</button>
            <button onClick={() => setMin(true)} title={L('Ocultar', 'Hide')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--mut)' }}>→</button>
          </span>
        </div>
        <div style={{ padding: '13px 14px' }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <span className="pill" style={{ fontSize: 10.5, color: 'var(--soft-brand)', background: 'rgba(124,140,255,.15)' }}>Lead</span>
            {l.priority === 'high' && <span className="pill" style={{ fontSize: 10.5, color: 'var(--red)', background: 'rgba(255,107,125,.15)' }}>{L('Alta', 'High')}</span>}
            <span className="pill" style={{ fontSize: 10.5, color: 'var(--mut)', background: 'var(--bg2)' }}>{catMap[l.category] || l.category}</span>
          </div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 5 }}>{l.email || '—'} · {ago(l.created_at)}</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.5, background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px', maxHeight: 110, overflow: 'auto' }}>{l.message}</div>
          {l.aiReply && (
            <div style={{ marginTop: 8, background: 'rgba(52,226,160,.08)', border: '1px solid rgba(52,226,160,.35)', borderRadius: 10, padding: '9px 11px' }}>
              <div style={{ fontSize: 11.5, color: 'var(--soft-green)', fontWeight: 600, marginBottom: 3 }}>🤖 {L('Onyx AI ya respondió', 'Onyx AI already replied')}</div>
              <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45, maxHeight: 66, overflow: 'hidden' }}>{l.aiReply}</div>
            </div>
          )}
        </div>
        <div className="row" style={{ gap: 8, padding: '11px 14px', borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <a className="btn btn-primary" href={`/admin?ticket=${l.id}#soporte`} style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => markSeen(l.id)}>{L('Abrir', 'Open')}</a>
          <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => markSeen(l.id)}>{L('Visto', 'Seen')}</button>
          {unseen.length > 1 && <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13, marginLeft: 'auto' }} onClick={() => markSeen(l.id)}>{L('Siguiente', 'Next')} ({unseen.length - 1})</button>}
        </div>
      </div>
    </>
  );
}
