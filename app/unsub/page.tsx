'use client';
import { useEffect, useState } from 'react';

// Página de baja: toma ?u=token, da de baja al abrir, y ofrece re-suscribirse.
// Bilingüe: usa ?lang=en si viene (el enlace del correo lo añade según el idioma
// del destinatario); por defecto español.
export default function UnsubPage() {
  const [state, setState] = useState<'loading' | 'done' | 'bad' | 'resub'>('loading');
  const [token, setToken] = useState('');
  const [en, setEn] = useState(false);
  const L = (es: string, e: string) => (en ? e : es);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setEn(sp.get('lang') === 'en');
    const u = sp.get('u') || '';
    setToken(u);
    if (!u) { setState('bad'); return; }
    fetch('/api/unsub?u=' + encodeURIComponent(u)).then((r) => r.json())
      .then((j) => setState(j.ok ? 'done' : 'bad')).catch(() => setState('bad'));
  }, []);

  async function resub() {
    const r = await fetch('/api/unsub', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ u: token }) });
    if (r.ok) setState('resub');
  }

  return (
    <div className="wrap" style={{ maxWidth: 520, margin: '0 auto', padding: '60px 18px', textAlign: 'center' }}>
      <img src="/onyx-symbol.png" alt="Onyx" style={{ width: 44, height: 44, objectFit: 'contain', marginBottom: 16 }} />
      {state === 'loading' && <p className="muted">…</p>}
      {state === 'bad' && (
        <>
          <h2>{L('Enlace no válido', 'Invalid link')}</h2>
          <p className="muted">{L('Este enlace no es válido o ya caducó. Puedes gestionar tus correos desde tu cuenta.', 'This link is invalid or expired. You can manage your emails from your account.')}</p>
        </>
      )}
      {state === 'done' && (
        <>
          <h2>{L('Te diste de baja ✓', "You've unsubscribed ✓")}</h2>
          <p className="muted" style={{ marginBottom: 18 }}>{L('Ya no recibirás correos de novedades ni promociones. Seguirás recibiendo avisos importantes de tu cuenta (facturación, soporte).', "You'll no longer receive news or promotional emails. You'll still get essential account notices (billing, support).")}</p>
          <button className="btn btn-ghost" onClick={resub}>{L('¿Fue un error? Volver a suscribirme', 'Was this a mistake? Re-subscribe')}</button>
        </>
      )}
      {state === 'resub' && (<><h2>{L('Suscripción reactivada ✓', "You're subscribed again ✓")}</h2><p className="muted">{L('Volverás a recibir novedades.', "You'll receive our updates again.")}</p></>)}
    </div>
  );
}
