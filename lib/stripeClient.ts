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

// Apariencia de los componentes de Stripe (Payment Element para cambiar/guardar
// tarjeta). SIEMPRE oscura 'night', igual que el checkout embebido del panel de
// Stripe, para que el monedero y la suscripción se vean iguales en cualquier
// tema del sitio. Antes seguía el tema: en modo claro salía blanco/crema y no
// coincidía con el checkout (que es oscuro). Además subimos el contraste de las
// etiquetas y textos para que nada quede casi invisible sobre el fondo oscuro.
export function onyxAppearance() {
  return {
    theme: 'night' as const,
    variables: {
      colorPrimary: '#7c8cff',
      colorBackground: '#12151d',
      colorText: '#f2f5fa',              // casi blanco: valores bien legibles
      colorTextSecondary: '#c3ccd8',     // antes #8a97a5 (muy tenue): ahora claro
      colorTextPlaceholder: '#8b96a6',
      colorDanger: '#ff6b63',
      colorIcon: '#c3ccd8',
      fontFamily: 'system-ui, sans-serif',
      borderRadius: '10px',
      spacingUnit: '4px',
    },
    rules: {
      '.Label': { color: '#e6ebf2', fontWeight: '600' },           // etiquetas bien visibles
      '.Input': { backgroundColor: '#1a1f2b', border: '1px solid #2b3342', color: '#f2f5fa', boxShadow: 'none' },
      '.Input::placeholder': { color: '#8b96a6' },
      '.Input:focus': { border: '1px solid #7c8cff', boxShadow: '0 0 0 1px #7c8cff' },
      '.Tab, .Block': { backgroundColor: '#1a1f2b', border: '1px solid #2b3342' },
      '.TabLabel, .BlockText': { color: '#e6ebf2' },
      '.CheckboxInput': { backgroundColor: '#1a1f2b', border: '1px solid #2b3342' },
    },
  };
}
