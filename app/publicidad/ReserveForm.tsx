'use client';
import { useState } from 'react';

type Slot = { key: string; name: string; size: string; priceLabel: string };

export default function ReserveForm({ slots, es }: { slots: Slot[]; es: boolean }) {
  const L = (a: string, b: string) => (es ? a : b);
  const [f, setF] = useState({ advertiser: '', contact: '', slot: slots[0]?.key || '', link: '', message: '' });
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr('');
    if (!f.advertiser.trim() || !f.contact.trim()) { setErr(L('Pon tu nombre y un contacto.', 'Enter your name and a contact.')); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/ads/reserve', { method: 'POST', body: JSON.stringify(f) });
      if (r.ok) setSent(true); else setErr(L('No se pudo enviar. Reintenta.', 'Could not send. Retry.'));
    } catch { setErr(L('Error de red.', 'Network error.')); } finally { setBusy(false); }
  }

  if (sent) return (
    <div className="card" style={{ textAlign: 'center', padding: 28 }}>
      <div style={{ fontSize: 32 }}>✅</div>
      <h3 style={{ margin: '8px 0 4px' }}>{L('¡Solicitud recibida!', 'Request received!')}</h3>
      <p className="muted" style={{ fontSize: 14 }}>{L('Te contactaremos para confirmar el espacio y el pago.', 'We’ll reach out to confirm the space and payment.')}</p>
    </div>
  );

  const lbl: any = { fontSize: 12, color: 'var(--mut)', marginBottom: 5 };
  return (
    <div className="card" id="reservar" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ margin: 0 }}>{L('Reservar un espacio', 'Reserve a space')}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
        <div><div style={lbl}>{L('Tu nombre / marca', 'Your name / brand')}</div><input value={f.advertiser} onChange={(e) => setF({ ...f, advertiser: e.target.value })} style={{ margin: 0, width: '100%' }} /></div>
        <div><div style={lbl}>{L('Email o WhatsApp', 'Email or WhatsApp')}</div><input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} style={{ margin: 0, width: '100%' }} /></div>
        <div><div style={lbl}>{L('Espacio', 'Space')}</div><select value={f.slot} onChange={(e) => setF({ ...f, slot: e.target.value })} style={{ margin: 0, width: '100%' }}>{slots.map((s) => <option key={s.key} value={s.key}>{s.name} · {s.size} · {s.priceLabel}</option>)}</select></div>
        <div><div style={lbl}>{L('Tu web (opcional)', 'Your website (optional)')}</div><input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="https://…" style={{ margin: 0, width: '100%' }} /></div>
        <div style={{ gridColumn: '1 / -1' }}><div style={lbl}>{L('Mensaje (opcional)', 'Message (optional)')}</div><textarea value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} rows={3} style={{ margin: 0, width: '100%' }} /></div>
      </div>
      {err && <div style={{ fontSize: 13, color: 'var(--red,#ef6262)' }}>{err}</div>}
      <button className="btn btn-primary" onClick={submit} disabled={busy} style={{ alignSelf: 'flex-start' }}>{busy ? '…' : L('Enviar solicitud', 'Send request')}</button>
    </div>
  );
}
