'use client';
import { useEffect, useState } from 'react';
import { nativePlatform } from '@/lib/native';
import OnyxIcon from '@/app/components/OnyxIcon';

// ============================================================
// Gestión de pago SOLO en iOS.
//
// Apple (regla 3.1.1) rechaza apps que venden/gestionan suscripciones digitales
// con un método de pago externo (Stripe) DENTRO de la app. Por eso, únicamente en
// la app de iPhone/iPad ocultamos cambiar tarjeta, subir/bajar de plan y
// suscribirse, y mostramos un aviso para gestionarlo en el sitio web.
//
// En Android y en el navegador NO cambia nada (Google sí lo permite).
//
// Usamos un hook con estado para evitar parpadeos de hidratación: en el primer
// render (servidor) devuelve false y, ya montado en el cliente, detecta iOS.
// ============================================================
export function useIsIOSApp(): boolean {
  const [ios, setIos] = useState(false);
  useEffect(() => {
    try { setIos(nativePlatform() === 'ios'); } catch {}
  }, []);
  return ios;
}

// Abre el sitio de Onyx FUERA de la app (Safari del sistema) para gestionar el
// pago. Usa el plugin Browser de Capacitor si está; si no, abre una pestaña.
export async function openOnyxWeb(path = '/account') {
  const url = 'https://www.onyxtradinglive.com' + path;
  try {
    const b = (window as any)?.Capacitor?.Plugins?.Browser;
    if (b?.open) { await b.open({ url }); return; }
  } catch {}
  try { window.open(url, '_blank'); } catch { try { (window.location as any).href = url; } catch {} }
}

// Aviso que sustituye a los controles de pago dentro de la app de iOS.
export default function ManageOnWeb({ lang, planName }: { lang: 'es' | 'en'; planName?: string }) {
  const es = lang === 'es';
  // Aviso NEUTRO en iOS: solo el estado del plan. Sin mención de web, compra,
  // "actualizar" ni "gestionar suscripción" (Apple prohíbe el steering a pagos
  // externos). Con la cuenta activa el trader usa la app con normalidad.
  // Navegación DENTRO de la app a la pantalla de Planes (/pricing), donde en iOS se
  // compra con Apple In-App Purchase. No es steering a pago externo: es la propia
  // pantalla de compra de Apple, así que cumple la regla 3.1.1.
  const goPlans = () => { try { window.location.href = '/pricing'; } catch {} };
  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 14 }}>
      <div style={{ background: 'rgba(124,140,255,.08)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ flex: 'none' }}><OnyxIcon emoji="✔" size={16} /></span>
          <div className="muted" style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.55 }}>
            {planName
              ? (es ? `Plan ${planName}.` : `${planName} plan.`) + ' '
              : ''}
            {es ? 'Tu cuenta está activa y puedes usar la app con normalidad.' : 'Your account is active and you can use the app normally.'}
          </div>
        </div>
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={goPlans}>
          {es ? 'Ver planes' : 'See plans'}
        </button>
      </div>
    </div>
  );
}
