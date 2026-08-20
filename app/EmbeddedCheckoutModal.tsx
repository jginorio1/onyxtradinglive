'use client';
import { useEffect, useRef, useState } from 'react';
import { getStripe } from '@/lib/stripeClient';
import { clearPending } from '@/lib/pendingCheckout';

// ============================================================
// Checkout EMBEBIDO de Stripe dentro de Onyx (mismo diseño, sin salir).
// Recibe el plan; pide el client_secret al backend (ui_mode: embedded) y
// monta el checkout en un modal. Al terminar, Stripe redirige a return_url.
// ============================================================

export default function EmbeddedCheckoutModal({
  plan, annual, lang, onClose, coupon,
}: { plan: string; annual: boolean; lang: 'es' | 'en'; onClose: () => void; coupon?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');
  const checkoutRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stripe = await getStripe();
        const r = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan, annual, embedded: true, coupon: coupon || undefined }) });
        // Invitado sin sesión: lo mandamos a REGISTRARSE conservando el plan (y si es
        // anual, y el cupón del enlace). Tras crear la cuenta vuelve a /pricing?plan=…
        // y el checkout se abre solo, con el descuento ya aplicado. No se pierde nada.
        if (r.status === 401) { window.location.href = `/login?mode=signup&plan=${encodeURIComponent(plan)}${annual ? '&annual=1' : ''}${coupon ? `&promo=${encodeURIComponent(coupon)}` : ''}`; return; }
        const j = await r.json();
        if (!r.ok || !j.clientSecret) { setErr(j.error || 'Error'); return; }
        if (cancelled) return;
        clearPending(); // el checkout ya abrió con sesión: intención consumida

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

  // Al cerrar, damos por consumida la intención para no reencaminar en bucle.
  const close = () => { clearPending(); onClose(); };

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 80, padding: 16, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 760, width: '100%', marginTop: 24 }}>
        <div className="row between" style={{ marginBottom: 12, alignItems: 'center' }}>
          <b style={{ fontSize: 15 }}>{lang === 'es' ? 'Finaliza tu suscripción' : 'Complete your subscription'}</b>
          <button className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 13 }} onClick={close}>✕</button>
        </div>
        {err ? <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div> : <div ref={box} style={{ minHeight: 260 }} />}
      </div>
    </div>
  );
}
