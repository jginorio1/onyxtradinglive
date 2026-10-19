'use client';
import { useEffect, useState } from 'react';
import { toast, toastErr } from '@/lib/toast';
import OnyxIcon from '@/app/components/OnyxIcon';

// Candado de permiso para una acción sensible del expediente (créditos de IA,
// add-ons, etc.). Si el admin PUEDE, muestra los controles reales (children).
// Si NO, muestra quién sí puede y botones para pedir ayuda en el chat de equipo
// (canal) o por DM directo a una persona con acceso, con el contexto ya armado.
type Who = { id: string; name: string; job_title: string };

export default function LockedAction(
  { action, label, clientEmail, canDo, lang = 'es', children }:
  { action: string; label: string; clientEmail: string; canDo: boolean; lang?: 'es' | 'en'; children: React.ReactNode },
) {
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const [who, setWho] = useState<Who[] | null>(null);
  const [titles, setTitles] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (canDo) return;
    setMsg(L(`Hola 👋 ¿Alguien con permiso puede ${label.toLowerCase()} al cliente ${clientEmail}? Lo necesito para atenderlo. Gracias.`,
            `Hi 👋 can someone with permission ${label.toLowerCase()} for customer ${clientEmail}? I need it to help them. Thanks.`));
    fetch('/api/admin/action-access?action=' + encodeURIComponent(action))
      .then((r) => r.json()).then((j) => { setWho(j.who || []); setTitles(j.titles || []); }).catch(() => setWho([]));
  }, [canDo]);

  if (canDo) return <>{children}</>;

  // Manda el mensaje al chat de equipo: a un canal general o a un DM.
  async function sendToChannel() {
    if (!msg.trim()) return;
    setBusy('ch');
    try {
      const r = await fetch('/api/team/chat'); const j = await r.json();
      const chans: any[] = j.channels || [];
      const ch = chans.find((c) => c.kind !== 'dm') || chans[0];
      if (!ch) { toast(L('No hay un canal de equipo todavía.', 'No team channel yet.')); return; }
      const m = await fetch('/api/team/chat/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel: ch.id, body: msg }) });
      if (!m.ok) { toastErr(await m.json().catch(() => ({}))); return; }
      toast(L('Pedido enviado al chat de equipo ✓', 'Sent to the team chat ✓'), 'ok');
    } finally { setBusy(''); }
  }
  async function sendDM(person: Who) {
    if (!msg.trim()) return;
    setBusy('dm:' + person.id);
    try {
      const r = await fetch('/api/team/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'dm', name: person.name, members: [person.id] }) });
      const j = await r.json(); if (!r.ok) { toastErr(j); return; }
      const chId = j.id || j.channel || (j.channel && j.channel.id);
      if (!chId) { toast(L('No se pudo abrir el DM.', 'Could not open the DM.')); return; }
      const m = await fetch('/api/team/chat/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel: chId, body: msg }) });
      if (!m.ok) { toastErr(await m.json().catch(() => ({}))); return; }
      toast(L(`Mensaje enviado a ${person.name} ✓`, `Message sent to ${person.name} ✓`), 'ok');
    } finally { setBusy(''); }
  }

  const amber = 'var(--amber,#e0a73e)';
  return (
    <div className="card" style={{ marginBottom: 12, borderLeft: `3px solid ${amber}` }}>
      <div className="row between" style={{ alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
        <span className="pill" style={{ fontSize: 10.5, fontWeight: 700, background: 'rgba(224,167,62,.16)', color: '#b26a00' }}><OnyxIcon emoji="🔒" size={13} /> {L('Sin permiso', 'No permission')}</span>
      </div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>{L('Esta acción cuesta dinero, por eso está restringida a quien tenga el permiso.', 'This action costs money, so it is restricted to those with permission.')}</div>

      <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '9px 11px', marginBottom: 10 }}>
        <div className="muted" style={{ fontSize: 10.5, marginBottom: 6 }}>{L('Quién puede hacerlo', 'Who can do this')}</div>
        {who === null && <div className="muted" style={{ fontSize: 12 }}>…</div>}
        {who && who.length === 0 && <div className="muted" style={{ fontSize: 12 }}>{L('Solo el dueño por ahora.', 'Only the owner for now.')}</div>}
        {who && who.length > 0 && (
          <div className="row" style={{ gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
            {titles.map((tt) => <span key={tt} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: 'color-mix(in srgb,var(--brand) 14%,transparent)', color: 'var(--brand)' }}>{tt}</span>)}
            {who.map((p) => <span key={p.id} style={{ fontSize: 12.5 }}>{p.name}</span>).reduce((acc: any[], el, i) => (i ? [...acc, <span key={'s' + i} className="muted" style={{ fontSize: 12 }}>·</span>, el] : [el]), [])}
          </div>
        )}
      </div>

      <div className="muted" style={{ fontSize: 10.5, marginBottom: 4 }}>{L('Mensaje (editable)', 'Message (editable)')}</div>
      <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} style={{ width: '100%', padding: '8px 10px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--tx)', fontSize: 12.5, fontFamily: 'inherit', marginBottom: 8 }} />
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" style={{ fontSize: 12.5, padding: '6px 12px' }} disabled={!!busy || !msg.trim()} onClick={sendToChannel}>
          <OnyxIcon emoji="💬" size={14} /> {busy === 'ch' ? '…' : L('Pedir ayuda en el chat', 'Ask for help in chat')}
        </button>
        {who && who[0] && (
          <button className="btn btn-ghost" style={{ fontSize: 12.5, padding: '6px 12px' }} disabled={!!busy || !msg.trim()} onClick={() => sendDM(who[0])}>
            <OnyxIcon emoji="📨" size={14} /> {busy.startsWith('dm') ? '…' : L(`DM a ${who[0].name}`, `DM ${who[0].name}`)}
          </button>
        )}
      </div>
    </div>
  );
}
