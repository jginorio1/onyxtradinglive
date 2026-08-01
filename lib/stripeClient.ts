'use client';

// ============================================================
// Cargador de Stripe.js en el navegador (desde el CDN oficial).
// Se usa para el Payment Element (cambiar tarjeta) y el Embedded
// Checkout (pagar dentro de Onyx, con nuestro diseño).
//
// Necesita la variable pública NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
// (empieza por pk_). Nunca uses aquí la clave secreta.
// ============================================================

let stripePromise: Promise<any> | null = null;

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('no window'));
    if ((window as any).Stripe) return resolve();
    const existing = document.querySelector('script[src="https://js.stripe.com/v3/"]');
    if (existing) { existing.addEventListener('load', () => resolve()); return; }
    const s = document.createElement('script');
    s.src = 'https://js.stripe.com/v3/';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('No se pudo cargar Stripe.js'));
    document.head.appendChild(s);
  });
}

export function getStripe(): Promise<any> {
  if (stripePromise) return stripePromise;
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  stripePromise = loadScript().then(() => {
    if (!pk) throw new Error('Falta NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
    return (window as any).Stripe(pk);
  });
  return stripePromise;
}

// Tema oscuro de Onyx para que los componentes de Stripe combinen con el panel.
export const onyxAppearance = {
  theme: 'night' as const,
  variables: {
    colorPrimary: '#7c8cff',
    colorBackground: '#12151d',
    colorText: '#e6ebf2',
    colorTextSecondary: '#8a97a5',
    colorDanger: '#e0504a',
    fontFamily: 'system-ui, sans-serif',
    borderRadius: '10px',
  },
};
