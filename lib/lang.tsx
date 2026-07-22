'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// ============================================================
// Idioma compartido por toda la app.
//
// Antes cada página guardaba el suyo en localStorage, así que la barra
// (que se dibuja en el servidor) no podía enterarse. Ahora vive también
// en una cookie: el servidor la lee y pinta la barra ya traducida, y el
// contexto mantiene sincronizadas todas las pantallas del cliente.
// ============================================================

export type Lang = 'es' | 'en';

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: 'es',
  setLang: () => {},
});

export const useLang = () => useContext(Ctx);

// Un año. El idioma no es algo que convenga olvidar entre visitas.
const MAX_AGE = 60 * 60 * 24 * 365;

export function LanguageProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const router = useRouter();

  // Si es la primera visita y no hay cookie, seguimos el idioma del navegador
  useEffect(() => {
    try {
      if (document.cookie.includes('onyx_lang=')) return;
      const stored = localStorage.getItem('onyx_lang');
      const guess: Lang = stored === 'en' || stored === 'es'
        ? (stored as Lang)
        : (navigator.language || '').toLowerCase().startsWith('en') ? 'en' : 'es';
      if (guess !== lang) apply(guess);
      else writeCookie(guess);
    } catch { /* sin cookies ni localStorage, nos quedamos con el inicial */ }
  }, []);

  function writeCookie(l: Lang) {
    try { document.cookie = `onyx_lang=${l}; path=/; max-age=${MAX_AGE}; samesite=lax`; } catch {}
    try { localStorage.setItem('onyx_lang', l); } catch {}
  }

  function apply(l: Lang) {
    setLangState(l);
    writeCookie(l);
    // Vuelve a pedir los componentes de servidor (la barra) con el idioma nuevo
    router.refresh();
  }

  return <Ctx.Provider value={{ lang, setLang: apply }}>{children}</Ctx.Provider>;
}

// Textos de la barra y del menú. Son pocos y no merecen un archivo aparte.
export const NAV_T: Record<Lang, Record<string, string>> = {
  es: {
    dashboard: 'Panel', accounts: 'Cuentas', manager: 'Gestor', admin: 'Admin',
    plans: 'Planes', ambassadors: 'Embajadores',
    login: 'Entrar', signup: 'Empezar gratis',
    myAccount: 'Mi cuenta', myPlan: 'Mi plan', referrals: 'Referidos', adminPanel: 'Panel de admin',
    signout: 'Cerrar sesión', language: 'Idioma',
    eaOn: 'EA activo', eaOff: 'EA sin señal',
    eaOnTitle: 'MetaTrader conectado', eaOffTitle: 'MetaTrader sin señal',
  },
  en: {
    dashboard: 'Dashboard', accounts: 'Accounts', manager: 'Manager', admin: 'Admin',
    plans: 'Plans', ambassadors: 'Ambassadors',
    login: 'Sign in', signup: 'Start free',
    myAccount: 'My account', myPlan: 'My plan', referrals: 'Referrals', adminPanel: 'Admin panel',
    signout: 'Sign out', language: 'Language',
    eaOn: 'EA live', eaOff: 'EA offline',
    eaOnTitle: 'MetaTrader connected', eaOffTitle: 'MetaTrader not reporting',
  },
};
