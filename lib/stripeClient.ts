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

// Apariencia de los componentes de Stripe SEGÚN EL TEMA del sitio.
// Antes estaba fijada a oscuro ('night'): en modo claro salían inputs oscuros
// con etiquetas gris claro sobre fondo blanco (mal contraste). Ahora lee
// data-theme del <html> y devuelve fondo blanco + texto negro en claro.
function currentTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'dark';
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
}

export function onyxAppearance() {
  const light = currentTheme() === 'light';
  return {
    theme: (light ? 'stripe' : 'night') as 'stripe' | 'night',
    variables: {
      colorPrimary: '#7c8cff',
      colorBackground: light ? '#ffffff' : '#12151d',
      colorText: light ? '#0d1117' : '#e6ebf2',          // negro en claro
      colorTextSecondary: light ? '#4a5568' : '#8a97a5', // gris oscuro legible en claro
      colorTextPlaceholder: light ? '#6b7280' : '#6b7684',
      colorDanger: '#e0504a',
      fontFamily: 'system-ui, sans-serif',
      borderRadius: '10px',
    },
    rules: light ? {
      '.Input': { border: '1px solid #d0d5dd', boxShadow: 'none' },
      '.Label': { color: '#0d1117' },
    } : {},
  };
}
