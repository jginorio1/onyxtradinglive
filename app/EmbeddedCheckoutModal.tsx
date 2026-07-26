'use client';
import { useEffect, useRef, useState } from 'react';
import { getStripe } from '@/lib/stripeClient';

// ============================================================
// Checkout EMBEBIDO de Stripe dentro de Onyx (mismo diseño, sin salir).
// Recibe el plan; pide el client_secret al backend (ui_mode: embedded) y
// monta el checkout en un modal. Al terminar, Stripe redirige a return_url.
// ============================================================

export default function EmbeddedCheckoutModal({
  plan, annual, lang, onClose,
}: { plan: string; annual: boolean; lang: 'es' | 'en'; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');
  const checkoutRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stripe = await getStripe();
        const r = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan, annual, embedded: true }) });
        if (r.status === 401) { window.location.href = '/login'; return; }
        const j = await r.json();
        if (!r.ok || !j.clientSecret) { setErr(j.error || 'Error'); return; }
        if (cancelled) return;
        const checkout = await stripe.initEmbeddedCheckout({ clientSecret: j.clientSecret });
        checkout.mount(box.current);
        checkoutRef.current = checkout;
      } catch (e: any) {
        setErr(String(e?.message || '').includes('PUBLISHABLE')
          ? (lang === 'es' ? 'Falta la clave pública de Stripe.' : 'Stripe publishable key is missing.')
          : (lang === 'es' ? 'No se pudo abrir el pago.' : 'Could not open checkout.'));
      }
    })();
    return () => { cancelled = true; try { checkoutRef.current?.destroy(); } catch {} };
  }, [plan, annual]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 80, padding: 16, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 620, width: '100%', marginTop: 30 }}>
        <div className="row between" style={{ marginBottom: 12, alignItems: 'center' }}>
          <b style={{ fontSize: 15 }}>{lang === 'es' ? 'Finaliza tu suscripción' : 'Complete your subscription'}</b>
          <button className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 13 }} onClick={onClose}>✕</button>
        </div>
        {err ? <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div> : <div ref={box} style={{ minHeight: 260 }} />}
      </div>
    </div>
  );
}
