'use client';
import { useMemo, useState } from 'react';

// Autoservicio: el anunciante elige espacio + periodos + creativo y paga con
// tarjeta. Al terminar, Stripe lo devuelve a /publicidad/gracias que activa la
// campaña sola. Web-only (los anuncios no se muestran en la app nativa).

type Slot = {
  key: string; name: string; size: string; unit: string; price: number;
  freeFrom: string | null; bookedUntil: string | null;
};

export default function BuyForm({ slots, es }: { slots: Slot[]; es: boolean }) {
  const L = (a: string, b: string) => (es ? a : b);
  const buyable = slots.filter((s) => s.unit !== 'cpm');
  const [slotKey, setSlotKey] = useState(buyable[0]?.key || '');
  const [periods, setPeriods] = useState(1);
  const [advertiser, setAdvertiser] = useState('');
  const [contact, setContact] = useState('');
  const [creative, setCreative] = useState('');
  const [link, setLink] = useState('');
  const [alt, setAlt] = useState('');
  const [geo, setGeo] = useState('all');
  const [lang, setLang] = useState('all');
  const [startsAt, setStartsAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const slot = useMemo(() => buyable.find((s) => s.key === slotKey) || buyable[0], [buyable, slotKey]);
  const unitWord = slot?.unit === 'month' ? L('mes(es)', 'month(s)') : L('semana(s)', 'week(s)');
  const total = slot ? slot.price * Math.max(1, periods) : 0;
  const fmt = (iso: string | null) => { try { return iso ? new Date(iso).toLocaleDateString(es ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short' }) : ''; } catch { return ''; } };
  const busyUntil = slot?.bookedUntil ? fmt(slot.bookedUntil) : '';

  const lbl: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, marginBottom: 4, display: 'block' };

  async function pay() {
    setErr('');
    if (!advertiser.trim() || !contact.trim()) { setErr(L('Pon tu nombre y contacto.', 'Enter your name and contact.')); return; }
    if (!/^https?:\/\//i.test(creative) || !/^https?:\/\//i.test(link)) { setErr(L('La imagen y el enlace deben empezar por http.', 'Image and link must start with http.')); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/ads/checkout', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slot: slotKey, periods, advertiser, contact, creative_url: creative, link_url: link, alt: alt || advertiser, geo, lang, starts_at: startsAt || undefined }),
      });
      const j = await r.json();
      if (j.ok && j.url) { window.location.href = j.url; return; }
      setErr(j.error || L('No se pudo iniciar el pago.', 'Could not start checkout.'));
    } catch { setErr(L('Error de red. Intenta de nuevo.', 'Network error. Try again.')); }
    setBusy(false);
  }

  return (
    <div id="reservar" className="card" style={{ padding: 22, marginTop: 8 }}>
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>{L('Compra tu espacio ahora', 'Buy your space now')}</h2>
      <p className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>
        {L('Paga con tarjeta y tu anuncio se activa solo. Recibirás un enlace para seguir sus resultados en vivo.',
           'Pay by card and your ad activates automatically. You’ll get a link to track its results live.')}
      </p>

      <div className="grid g2" style={{ gap: 14 }}>
        <div>
          <label style={lbl}>{L('Espacio', 'Space')}</label>
          <select value={slotKey} onChange={(e) => setSlotKey(e.target.value)} style={{ margin: 0, width: '100%' }}>
            {buyable.map((s) => <option key={s.key} value={s.key}>{s.name} · {s.size} · ${s.price}/{s.unit === 'month' ? L('mes', 'mo') : L('sem', 'wk')}</option>)}
          </select>
          {busyUntil && <div style={{ fontSize: 12, color: '#c98a00', marginTop: 4 }}>{L(`Reservado hasta ${busyUntil}. Elige una fecha de inicio posterior.`, `Booked until ${busyUntil}. Pick a later start date.`)}</div>}
        </div>
        <div>
          <label style={lbl}>{L(`Duración (${unitWord})`, `Duration (${unitWord})`)}</label>
          <input type="number" min={1} max={52} value={periods} onChange={(e) => setPeriods(Math.max(1, Math.min(52, parseInt(e.target.value, 10) || 1)))} style={{ margin: 0, width: '100%' }} />
        </div>
        <div><label style={lbl}>{L('Tu nombre / marca', 'Your name / brand')}</label><input value={advertiser} onChange={(e) => setAdvertiser(e.target.value)} style={{ margin: 0, width: '100%' }} /></div>
        <div><label style={lbl}>{L('Email de contacto', 'Contact email')}</label><input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="tu@correo.com" style={{ margin: 0, width: '100%' }} /></div>
        <div><label style={lbl}>{L('URL de la imagen (creativo)', 'Image URL (creative)')}</label><input value={creative} onChange={(e) => setCreative(e.target.value)} placeholder={`https://… (${slot?.size || ''})`} style={{ margin: 0, width: '100%' }} /></div>
        <div><label style={lbl}>{L('Enlace de destino', 'Destination link')}</label><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" style={{ margin: 0, width: '100%' }} /></div>
        <div><label style={lbl}>{L('Texto alternativo (alt)', 'Alt text')}</label><input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder={advertiser} style={{ margin: 0, width: '100%' }} /></div>
        <div><label style={lbl}>{L('Fecha de inicio (opcional)', 'Start date (optional)')}</label><input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} style={{ margin: 0, width: '100%' }} /></div>
        <div>
          <label style={lbl}>{L('Idioma del público', 'Audience language')}</label>
          <select value={lang} onChange={(e) => setLang(e.target.value)} style={{ margin: 0, width: '100%' }}>
            <option value="all">{L('Todos', 'All')}</option><option value="es">Español</option><option value="en">English</option>
          </select>
        </div>
        <div><label style={lbl}>{L('País (ISO, coma) o "all"', 'Country (ISO, comma) or "all"')}</label><input value={geo} onChange={(e) => setGeo(e.target.value)} placeholder="all · US,MX,ES" style={{ margin: 0, width: '100%' }} /></div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>${total.toLocaleString()}<span className="muted" style={{ fontSize: 13, fontWeight: 500 }}> USD</span></div>
          <div className="muted" style={{ fontSize: 12 }}>{slot ? L(`${periods} × $${slot.price} (${slot.name})`, `${periods} × $${slot.price} (${slot.name})`) : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={pay} disabled={busy || total <= 0} style={{ minWidth: 200 }}>
          {busy ? L('Abriendo pago…', 'Opening checkout…') : L('Pagar con tarjeta →', 'Pay by card →')}
        </button>
      </div>
      {err && <div style={{ color: '#e5484d', fontSize: 13, marginTop: 10 }}>{err}</div>}
      <p className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>
        {L('Pago seguro con Stripe. Al pagar aceptas las especificaciones del creativo. Reembolso a prorrateo si retiramos el anuncio por incumplir las reglas.',
           'Secure payment via Stripe. By paying you accept the creative specs. Pro-rated refund if we remove the ad for breaking the rules.')}
      </p>
    </div>
  );
}
