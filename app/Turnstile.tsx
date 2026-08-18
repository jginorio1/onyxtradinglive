'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// CAPTCHA de Cloudflare Turnstile (gratis). Se muestra SOLO si está configurada
// NEXT_PUBLIC_TURNSTILE_SITE_KEY; si no, no aparece y no bloquea.
export const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

// El token de Turnstile es de UN SOLO USO y caduca (~5 min). Si se reenvía el
// mismo token, o uno viejo, Cloudflare/Supabase lo rechaza como
// "timeout-or-duplicate". Para eliminarlo del todo NO reusamos el token que se
// generó al cargar la página: getToken() ACUÑA uno nuevo (reset + espera el
// callback) en el mismo instante del envío. Así el token siempre tiene <1s.
export type TurnstileHandle = { reset: () => void; getToken: () => Promise<string> };

const Turnstile = forwardRef<TurnstileHandle, { onToken: (t: string) => void }>(function Turnstile({ onToken }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<any>(null);
  const cb = useRef(onToken);
  cb.current = onToken;
  const last = useRef<string>('');                                  // último token entregado
  const waiter = useRef<{ resolve: (t: string) => void; timer: any } | null>(null);

  // Entrega un token (o '' si falló/expiró) a la app y, si alguien está esperando
  // en getToken(), resuelve su promesa.
  const deliver = (tok: string) => {
    last.current = tok;
    cb.current(tok);
    if (waiter.current) { clearTimeout(waiter.current.timer); const r = waiter.current.resolve; waiter.current = null; r(tok); }
  };

  useImperativeHandle(ref, () => ({
    reset() {
      try { const tw = (window as any).turnstile; if (tw && widget.current != null) { last.current = ''; cb.current(''); tw.reset(widget.current); } } catch { /* noop */ }
    },
    // Devuelve un token FRESCO. Resetea el widget y espera a que el reto se
    // resuelva (los widgets "managed" lo hacen solos en <1s). Si no llega en 6s,
    // cae al último token disponible para no bloquear al usuario.
    getToken() {
      return new Promise<string>((resolve) => {
        if (!TURNSTILE_KEY) return resolve('');
        const tw = (window as any).turnstile;
        if (!tw || widget.current == null) return resolve(last.current || '');
        if (waiter.current) { clearTimeout(waiter.current.timer); waiter.current = null; }
        const timer = setTimeout(() => { waiter.current = null; resolve(last.current || ''); }, 6000);
        waiter.current = { resolve, timer };
        try { last.current = ''; cb.current(''); tw.reset(widget.current); }
        catch { clearTimeout(timer); waiter.current = null; resolve(''); }
      });
    },
  }), []);

  useEffect(() => {
    if (!TURNSTILE_KEY) return;
    const render = () => {
      const tw = (window as any).turnstile;
      if (!tw || !box.current || widget.current != null) return;   // no re-renderizar (evita tokens duplicados)
      widget.current = tw.render(box.current, {
        sitekey: TURNSTILE_KEY,
        callback: (tok: string) => deliver(tok),
        'error-callback': () => deliver(''),
        // Al caducar, pedimos otro automáticamente para no dejar un token vencido.
        'expired-callback': () => { last.current = ''; cb.current(''); try { (window as any).turnstile?.reset(widget.current); } catch {} },
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
