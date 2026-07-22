// Textos de la barra de navegación.
//
// IMPORTANTE: este archivo NO lleva 'use client' a propósito.
// La barra se dibuja en el servidor, y un componente de servidor no puede
// leer dentro de un módulo de cliente ("Cannot access es.plans on the
// server"). Al vivir aquí, lo pueden usar los dos lados.

export type Lang = 'es' | 'en';

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
