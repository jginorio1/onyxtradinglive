'use client';
import { useEffect, useState } from 'react';

// Página de baja: toma ?u=token, da de baja al abrir, y ofrece re-suscribirse.
export default function UnsubPage() {
  const [state, setState] = useState<'loading' | 'done' | 'bad' | 'resub'>('loading');
  const [token, setToken] = useState('');

  useEffect(() => {
    const u = new URLSearchParams(window.location.search).get('u') || '';
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
          <h2>Enlace no válido</h2>
          <p className="muted">This link is invalid or expired. Puedes gestionar tus correos desde tu cuenta.</p>
        </>
      )}
      {state === 'done' && (
        <>
          <h2>Te diste de baja ✓</h2>
          <p className="muted" style={{ marginBottom: 6 }}>Ya no recibirás correos de novedades ni promociones. Seguirás recibiendo avisos importantes de tu cuenta (facturación, soporte).</p>
          <p className="muted" style={{ marginBottom: 18 }}>You've been unsubscribed from marketing emails. You'll still get essential account notices.</p>
          <button className="btn btn-ghost" onClick={resub}>¿Fue un error? Volver a suscribirme / Re-subscribe</button>
        </>
      )}
      {state === 'resub' && (<><h2>Suscripción reactivada ✓</h2><p className="muted">Volverás a recibir novedades. You're subscribed again.</p></>)}
    </div>
  );
}
