// Textos de la barra de navegación.
//
// IMPORTANTE: este archivo NO lleva 'use client' a propósito.
// La barra se dibuja en el servidor, y un componente de servidor no puede
// leer dentro de un módulo de cliente ("Cannot access es.plans on the
// server"). Al vivir aquí, lo pueden usar los dos lados.

export type Lang = 'es' | 'en';

export const NAV_T: Record<Lang, Record<string, string>> = {
  es: {
    dashboard: 'Panel', accounts: 'Cuentas', manager: 'Guardian', copy: 'Copy', bots: 'Bots', support: 'Soporte', admin: 'Admin',
    home: 'Inicio', plans: 'Planes', ambassadors: 'Embajadores', guide: 'Guía',
    login: 'Entrar', signup: 'Empezar gratis',
    myAccount: 'Mi cuenta', myPlan: 'Mi plan', referrals: 'Referidos', adminPanel: 'Panel de admin', academy: 'Onyx Academy',
    signout: 'Cerrar sesión', language: 'Idioma',
    eaOn: 'EA activo', eaOff: 'EA sin señal',
    eaOnTitle: 'Cuenta conectada', eaOffTitle: 'Cuenta sin señal',
  },
  en: {
    dashboard: 'Dashboard', accounts: 'Accounts', manager: 'Guardian', copy: 'Copy', bots: 'Bots', support: 'Support', admin: 'Admin',
    home: 'Home', plans: 'Plans', ambassadors: 'Ambassadors', guide: 'Guide',
    login: 'Sign in', signup: 'Start free',
    myAccount: 'My account', myPlan: 'My plan', referrals: 'Referrals', adminPanel: 'Admin panel', academy: 'Onyx Academy',
    signout: 'Sign out', language: 'Language',
    eaOn: 'EA live', eaOff: 'EA offline',
    eaOnTitle: 'Account connected', eaOffTitle: 'Account not reporting',
  },
};
