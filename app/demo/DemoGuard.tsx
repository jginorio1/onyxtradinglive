'use client';
import { useEffect } from 'react';

// Guardián del demo público.
// Dentro de /demo no hay sesión, así que cualquier clic que navegue a una ruta
// interna (Mi cuenta, Planes, Cerrar sesión, el logo, botones del dashboard…)
// mandaría al visitante al login y lo sacaría del demo. Este guardián intercepta
// esos clics y los bloquea, mostrando un aviso de "regístrate". Los anclas en la
// misma página (#secciones) y los enlaces externos (otra pestaña) sí funcionan.
export default function DemoGuard({ lang = 'es' }: { lang?: 'es' | 'en' }) {
  const es = lang === 'es';
  useEffect(() => {
    let toastT: any = null;
    const toast = (msg: string) => {
      let el = document.getElementById('demo-toast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'demo-toast';
        el.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:99999;background:#0b0f1a;color:#eef1f7;border:1px solid rgba(127,144,255,.5);padding:10px 16px;border-radius:12px;font:500 13px system-ui,sans-serif;box-shadow:0 10px 30px -8px rgba(0,0,0,.6);max-width:92vw;text-align:center;opacity:0;transition:opacity .2s';
        document.body.appendChild(el);
      }
      el.textContent = msg;
      requestAnimationFrame(() => { el!.style.opacity = '1'; });
      clearTimeout(toastT);
      toastT = setTimeout(() => { if (el) el.style.opacity = '0'; }, 2600);
    };

    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest?.('a') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (!href || href.startsWith('#')) return;
      let url: URL;
      try { url = new URL(a.href, location.href); } catch { return; }
      // Externo: permitir SOLO si es otro sitio. Un enlace interno con
      // target="_blank" (p. ej. "Ver" del trackrecord) abriría una página que
      // no existe sin sesión (/u/demo → 404), así que también lo bloqueamos.
      if (url.origin !== location.origin) return;       // externo real: permitir
      const p = url.pathname;
      if (p === '/demo' || p.startsWith('/demo/')) return; // dentro del demo: permitir
      if (p === location.pathname && url.hash) return;      // ancla en la misma página
      // Cualquier otra ruta interna (protegida o pública), incluso en pestaña
      // nueva → bloquear y avisar.
      e.preventDefault();
      e.stopPropagation();
      (e as any).stopImmediatePropagation?.();
      toast(es ? 'Esto es una demostración. Crea tu cuenta para usar tu panel real.' : 'This is a demo. Create your account to use your real dashboard.');
    };

    // Bloquea también envíos de formularios a rutas internas (p. ej. /auth/signout).
    const onSubmit = (e: Event) => {
      const form = e.target as HTMLFormElement;
      const action = form?.getAttribute?.('action') || '';
      if (!action) return;
      let url: URL;
      try { url = new URL(action, location.href); } catch { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === '/demo' || url.pathname.startsWith('/demo/')) return;
      e.preventDefault();
      e.stopPropagation();
      toast(es ? 'Esto es una demostración. Crea tu cuenta para usar tu panel real.' : 'This is a demo. Create your account to use your real dashboard.');
    };

    document.addEventListener('click', onClick, true); // captura: corre antes que Next
    document.addEventListener('submit', onSubmit, true);
    return () => { document.removeEventListener('click', onClick, true); document.removeEventListener('submit', onSubmit, true); clearTimeout(toastT); const el = document.getElementById('demo-toast'); if (el) el.remove(); };
  }, [es]);

  return null;
}
