'use client';
import { useEffect, useRef } from 'react';

// CAPTCHA invisible de Cloudflare Turnstile (gratis). Se muestra SOLO si está
// configurada NEXT_PUBLIC_TURNSTILE_SITE_KEY; si no, no aparece y no bloquea.
export const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

export default function Turnstile({ onToken }: { onToken: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!TURNSTILE_KEY) return;
    let widgetId: any;
    const render = () => {
      const tw = (window as any).turnstile;
      if (!tw || !ref.current) return;
      widgetId = tw.render(ref.current, {
        sitekey: TURNSTILE_KEY,
        callback: (tok: string) => onToken(tok),
        'error-callback': () => onToken(''),
        'expired-callback': () => onToken(''),
      });
    };
    if ((window as any).turnstile) { render(); }
    else {
      const id = 'cf-turnstile-script';
      if (!document.getElementById(id)) {
        const s = document.createElement('script');
        s.id = id; s.async = true;
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.onload = render; document.head.appendChild(s);
      } else {
        const t = setInterval(() => { if ((window as any).turnstile) { clearInterval(t); render(); } }, 200);
      }
    }
    return () => { try { (window as any).turnstile?.remove(widgetId); } catch {} };
  }, []);
  if (!TURNSTILE_KEY) return null;
  return <div ref={ref} style={{ marginTop: 12 }} />;
}
