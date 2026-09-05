'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getPending, clearPending, pendingPricingUrl, type Pending } from '@/lib/pendingCheckout';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { useLang } from '@/lib/lang';

// Red de seguridad de la COMPRA. Si un usuario recién registrado quería comprar un
// plan (hay una intención guardada) y, tras confirmar el email o el onboarding,
// aterriza donde no debe (home o dashboard, que pierden los parámetros de la URL):
//   • En el HOME lo reencaminamos SOLO al checkout de su plan (transición limpia).
//   • En el DASHBOARD mostramos una franja "Continúa con tu compra →" en vez de
//     secuestrar la pantalla, para que decida él con un clic.
// No hace nada para invitados sin sesión (así no se crea un bucle con /login).
const SKIP = ['/pricing', '/login', '/onboarding', '/checkout', '/terms', '/privacy', '/api', '/admin'];

export default function PendingCheckoutGate() {
  const path = usePathname() || '/';
  const { lang } = useLang();
  const [pend, setPend] = useState<Pending | null>(null);
  const onDashboard = path.startsWith('/dashboard') || path.startsWith('/account');

  useEffect(() => {
    setPend(null);
    if (SKIP.some((p) => path.startsWith(p))) return;
    const p = getPending();
    if (!p) return;
    let done = false;
    (async () => {
      try {
        const { data } = await supabaseBrowser().auth.getSession();
        if (done) return;
        if (!data?.session?.user) return;                 // invitado sin sesión: no tocar
        if (onDashboard) { setPend(p); return; }           // dashboard → mostrar franja
        window.location.replace(pendingPricingUrl(p));     // resto → al checkout directo
      } catch {}
    })();
    return () => { done = true; };
  }, [path]);

  if (!pend || !onDashboard) return null;
  const label = pend.plan.charAt(0).toUpperCase() + pend.plan.slice(1);
  const go = () => { window.location.href = pendingPricingUrl(pend); };
  const dismiss = () => { clearPending(); setPend(null); };
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 90, display: 'flex', justifyContent: 'center', padding: 12, pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto', maxWidth: 560, width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px', boxShadow: '0 10px 30px rgba(0,0,0,.35)' }}>
        <span style={{ fontSize: 20 }}>🛒</span>
        <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.4 }}>
          <b>{lang === 'es' ? `Te faltó terminar tu plan ${label}` : `You didn't finish your ${label} plan`}</b>
          <div className="muted" style={{ fontSize: 12.5 }}>
            {lang === 'es' ? 'Continúa el pago con el descuento ya aplicado.' : 'Continue checkout with the discount already applied.'}
          </div>
        </div>
        <button className="btn btn-primary" style={{ fontSize: 13, whiteSpace: 'nowrap' }} onClick={go}>
          {lang === 'es' ? 'Continuar' : 'Continue'}
        </button>
        <button className="btn btn-ghost" style={{ fontSize: 13, padding: '6px 10px' }} onClick={dismiss} aria-label="cerrar">✕</button>
      </div>
    </div>
  );
}
