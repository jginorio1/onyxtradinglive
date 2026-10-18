'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import Icon from '@/app/components/Icons';

// Editor de RUTEO automático + ESCALAMIENTO por niveles (Admin → Soporte).
// Plegable, se guarda en /api/admin/support/routing.

export default function SupportRoutingCard() {
  const { lang } = useLang(); const es = lang !== 'en';
  const [open, setOpen] = useState(false);
  const [r, setR] = useState<any>(null);
  const [e, setE] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { fetch('/api/admin/support/routing').then((x) => x.json()).then((j) => { setR(j.routing); setE(j.escalation); }).catch(() => {}); }, []);
  function save(nextR: any, nextE: any) {
    setR(nextR); setE(nextE);
    fetch('/api/admin/support/routing', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ routing: nextR, escalation: nextE }) })
      .then(() => { setSaved(true); setTimeout(() => setSaved(false), 1200); }).catch(() => {});
  }
  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <span onClick={onClick} style={{ cursor: 'pointer', width: 38, height: 22, borderRadius: 999, background: on ? 'var(--brand)' : 'var(--line)', position: 'relative', flex: 'none', transition: 'background .15s' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
    </span>
  );
  const row = (label: string, on: boolean, onClick: () => void) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <span style={{ flex: 1, fontSize: 12.5 }}>{label}</span><Toggle on={on} onClick={onClick} />
    </div>
  );

  return (
    <div className="card" style={{ padding: '10px 14px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, flex: 'none', background: 'linear-gradient(135deg,#a78bfa,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🎯</span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{es ? 'Ruteo y escalamiento' : 'Routing & escalation'}</div>
          <div className="muted" style={{ fontSize: 12 }}>{es ? 'Asigna tickets por idioma/categoría/carga y escala si el equipo tarda.' : 'Assign by language/category/load and escalate when the team is slow.'}</div>
        </div>
        {r && <Toggle on={!!r.on} onClick={() => save({ ...r, on: !r.on }, e)} />}
        <button className="wa-hb" onClick={() => setOpen((v) => !v)} title={es ? 'Ajustar' : 'Tune'} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><Icon name="chevronDown" size={16} /></button>
      </div>
      {open && r && e && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2, color: 'var(--mut)' }}>{es ? 'Cómo se elige al agente' : 'How the agent is picked'}</div>
          {row(es ? 'Priorizar quien hable el idioma del cliente' : 'Prefer who speaks the customer language', !!r.byLanguage, () => save({ ...r, byLanguage: !r.byLanguage }, e))}
          {row(es ? 'Priorizar por categoría (puesto del agente)' : 'Prefer by category (agent role)', !!r.byCategory, () => save({ ...r, byCategory: !r.byCategory }, e))}
          {row(es ? 'Repartir al de menos tickets abiertos' : 'Give to the least-loaded agent', !!r.balanceLoad, () => save({ ...r, balanceLoad: !r.balanceLoad }, e))}
          {row(es ? 'Solo a agentes "disponibles"' : 'Only to "available" agents', !!r.onlyAvailable, () => save({ ...r, onlyAvailable: !r.onlyAvailable }, e))}

          <div style={{ fontSize: 12, fontWeight: 600, margin: '12px 0 4px', color: 'var(--mut)' }}>{es ? 'Escalamiento por niveles' : 'Escalation ladder'}</div>
          {row(es ? 'Activar escalamiento automático' : 'Enable auto-escalation', !!e.on, () => save(r, { ...e, on: !e.on }))}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            <label style={{ fontSize: 12 }}>{es ? 'Subir a N2 (min)' : 'To L2 (min)'}<input type="number" min={10} value={e.l2AfterMin} onChange={(x) => setE({ ...e, l2AfterMin: Number(x.target.value) })} onBlur={() => save(r, e)} style={{ display: 'block', width: 100, marginTop: 3 }} /></label>
            <label style={{ fontSize: 12 }}>{es ? 'Subir a supervisor (min)' : 'To supervisor (min)'}<input type="number" min={20} value={e.l3AfterMin} onChange={(x) => setE({ ...e, l3AfterMin: Number(x.target.value) })} onBlur={() => save(r, e)} style={{ display: 'block', width: 120, marginTop: 3 }} /></label>
            <label style={{ fontSize: 12, flex: 1, minWidth: 180 }}>{es ? 'Correo del supervisor (opcional)' : 'Supervisor email (optional)'}<input type="email" value={e.supervisorEmail || ''} onChange={(x) => setE({ ...e, supervisorEmail: x.target.value })} onBlur={() => save(r, e)} placeholder={es ? 'si vacío, el dueño' : 'if empty, the owner'} style={{ display: 'block', width: '100%', marginTop: 3 }} /></label>
          </div>
          <div style={{ fontSize: 11, color: saved ? 'var(--green)' : 'var(--mut)', marginTop: 8 }}>{saved ? (es ? 'Guardado ✓' : 'Saved ✓') : (es ? 'Los cambios se guardan solos.' : 'Changes save automatically.')}</div>
        </div>
      )}
    </div>
  );
}
