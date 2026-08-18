'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// CAPTCHA invisible de Cloudflare Turnstile (gratis). Se muestra SOLO si está
// configurada NEXT_PUBLIC_TURNSTILE_SITE_KEY; si no, no aparece y no bloquea.
export const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

// El token de Turnstile es de UN SOLO USO y caduca (~5 min). Si se reenvía el
// mismo token (segundo intento, o token viejo), Cloudflare lo rechaza como
// "timeout-or-duplicate". Por eso exponemos reset(): el login lo llama tras cada
// intento para acuñar un token fresco. Además, al expirar, nos auto-reseteamos.
export type TurnstileHandle = { reset: () => void };

const Turnstile = forwardRef<TurnstileHandle, { onToken: (t: string) => void }>(function Turnstile({ onToken }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<any>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useImperativeHandle(ref, () => ({
    reset() {
      try {
        const tw = (window as any).turnstile;
        if (tw && widget.current != null) { cb.current(''); tw.reset(widget.current); }
      } catch { /* noop */ }
    },
  }), []);

  useEffect(() => {
    if (!TURNSTILE_KEY) return;
    const render = () => {
      const tw = (window as any).turnstile;
      if (!tw || !box.current || widget.current != null) return;
      widget.current = tw.render(box.current, {
        sitekey: TURNSTILE_KEY,
        callback: (tok: string) => cb.current(tok),
        'error-callback': () => cb.current(''),
        // Al caducar el token, pedimos uno nuevo automáticamente (sin molestar al
        // usuario) para que el siguiente intento nunca lleve un token vencido.
        'expired-callback': () => { cb.current(''); try { (window as any).turnstile?.reset(widget.current); } catch {} },
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
    return () => { try { (window as any).turnstile?.remove(widget.current); widget.current = null; } catch {} };
  }, []);

  if (!TURNSTILE_KEY) return null;
  return <div ref={box} style={{ marginTop: 12 }} />;
});

export default Turnstile;
