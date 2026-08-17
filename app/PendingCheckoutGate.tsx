'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getPending, pendingPricingUrl } from '@/lib/pendingCheckout';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

// Red de seguridad de la COMPRA. Si un usuario recién registrado quería comprar un
// plan (hay una intención guardada) y, tras confirmar el email o el onboarding,
// aterriza en el home o en el dashboard (donde se pierden los parámetros), lo
// llevamos al checkout de ese plan en cuanto detectamos que ya tiene sesión.
// No hace nada para invitados sin sesión (así no se crea un bucle con /login).
const SKIP = ['/pricing', '/login', '/onboarding', '/checkout', '/terms', '/privacy', '/api'];

export default function PendingCheckoutGate() {
  const path = usePathname() || '/';
  useEffect(() => {
    if (SKIP.some((p) => path.startsWith(p))) return;
    const pend = getPending();
    if (!pend) return;
    let done = false;
    (async () => {
      try {
        const { data } = await supabaseBrowser().auth.getSession();
        if (done) return;
        if (data?.session?.user) {
          // Tiene sesión → al checkout de su plan. NO limpiamos aquí: /pricing
          // consume la intención al abrir el checkout (y así sobrevive a un refresh).
          window.location.replace(pendingPricingUrl(pend));
        }
      } catch {}
    })();
    return () => { done = true; };
  }, [path]);
  return null;
}
