'use client';
import { useEffect, useRef, useState } from 'react';
import { getStripe } from '@/lib/stripeClient';
import { isNativeApp } from '@/lib/native';

// ============================================================
// Recarga del monedero EMBEBIDA dentro de Onyx (igual que el pago de suscripción).
// Recibe el monto; pide el client_secret al backend (ui_mode: embedded) y monta
// el checkout en un modal. Al terminar, Stripe redirige a return_url (?topup=ok).
// En la app nativa se abre un checkout ALOJADO en el navegador del sistema.
// ============================================================

export default function WalletCheckoutModal({
  amount, lang, onClose, mode = 'topup',
}: { amount?: number; lang: 'es' | 'en'; onClose: () => void; mode?: 'topup' | 'setup' }) {
  const box = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');
  const [nativeUrl, setNativeUrl] = useState('');
  const checkoutRef = useRef<any>(null);
  const es = lang === 'es';
  const isSetup = mode === 'setup';
  // Endpoint y cuerpo según el modo: recargar saldo (topup) o guardar tarjeta (setup).
  const endpoint = isSetup ? '/api/wallet/autoreload/setup' : '/api/wallet/topup';
  const bodyBase = isSetup ? {} : { method: 'card', amount, lang };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isNativeApp()) {
          const r = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(bodyBase) });
          const j = await r.json();
          if (cancelled) return;
          if (!r.ok || !j.url) { setErr(j.error || (es ? 'No se pudo abrir.' : 'Could not open.')); return; }
          setNativeUrl(j.url);
          try { window.open(j.url, '_blank'); } catch { /* el usuario puede usar el botón */ }
          return;
        }

        const stripe = await getStripe();
        const r = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...bodyBase, embedded: true }) });
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok || !j.clientSecret) { setErr(j.error || (es ? 'No se pudo abrir.' : 'Could not open.')); return; }
        const checkout = await stripe.initEmbeddedCheckout({ clientSecret: j.clientSecret });
        checkout.mount(box.current);
        checkoutRef.current = checkout;
      } catch (e: any) {
        setErr(String(e?.message || '').includes('PUBLISHABLE')
          ? (es ? 'Falta la clave pública de Stripe.' : 'Stripe publishable key is missing.')
          : (es ? 'No se pudo abrir.' : 'Could not open.'));
      }
    })();
    return () => { cancelled = true; try { checkoutRef.current?.destroy(); } catch {} };
  }, [amount, mode]);

  const title = isSetup
    ? (es ? 'Guardar una tarjeta' : 'Save a card')
    : (es ? `Recargar $${amount}` : `Top up $${amount}`);

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 80, padding: 16, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 760, width: '100%', marginTop: 24 }}>
        <div className="row between" style={{ marginBottom: 12, alignItems: 'center' }}>
          <b style={{ fontSize: 15 }}>{title}</b>
          <button className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 13 }} onClick={onClose}>✕</button>
        </div>
        {err ? <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>
          : nativeUrl ? (
            <div style={{ textAlign: 'center', padding: '18px 8px' }}>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--tx)' }}>
                {es
                  ? 'Tu pago se abrió en el navegador para completarlo de forma segura. Al terminar, vuelve a la app.'
                  : 'Your payment opened in the browser to complete it securely. When you’re done, come back to the app.'}
              </p>
              <a className="btn btn-primary" href={nativeUrl} target="_blank" rel="noreferrer" style={{ marginTop: 10, display: 'inline-block' }}>
                {es ? 'Abrir el pago en el navegador' : 'Open payment in browser'}
              </a>
            </div>
          ) : <div ref={box} style={{ minHeight: 260 }} />}
      </div>
    </div>
  );
}
