// Textos de la barra de navegación.
//
// IMPORTANTE: este archivo NO lleva 'use client' a propósito.
// La barra se dibuja en el servidor, y un componente de servidor no puede
// leer dentro de un módulo de cliente. Al vivir aquí, lo pueden usar los dos lados.

// Idiomas soportados. es/en son los base; zh/ja/pt/vi se traducen y, si falta
// alguna clave, el motor (lib/i18n) cae al inglés.
export type Lang = 'es' | 'en' | 'zh' | 'ja' | 'pt' | 'vi';
// App en 2 idiomas (Español / Inglés). La infraestructura de más idiomas queda
// en el código pero DESACTIVADA aquí: al no listarlos, el selector solo muestra
// es/en, y `asLang` recorta cualquier otro a es/en → el traductor nunca construye
// diccionarios nuevos (100% estable, sin riesgo de error). Para reactivar más
// idiomas en el futuro, vuelve a añadirlos a esta lista (y a PREFIXES en middleware).
export const LANGS: Lang[] = ['es', 'en'];
// Nombre nativo + bandera para el selector.
export const LANG_META: Record<Lang, { native: string; flag: string }> = {
  es: { native: 'Español', flag: '🇪🇸' },
  en: { native: 'English', flag: '🇬🇧' },
  zh: { native: '中文', flag: '🇨🇳' },
  ja: { native: '日本語', flag: '🇯🇵' },
  pt: { native: 'Português', flag: '🇧🇷' },
  vi: { native: 'Tiếng Việt', flag: '🇻🇳' },
};

export const NAV_T: Record<Lang, Record<string, string>> = {
  es: {
    dashboard: 'Panel', accounts: 'Cuentas', manager: 'Guardian', copy: 'Copy', bots: 'Mis robots', support: 'Soporte', admin: 'Admin',
    home: 'Inicio', plans: 'Planes', ambassadors: 'Embajadores', guide: 'Guía',
    login: 'Entrar', signup: 'Empezar gratis',
    myAccount: 'Mi cuenta', myPlan: 'Mi plan', referrals: 'Referidos', adminPanel: 'Panel de admin', academy: 'Onyx Academy',
    signout: 'Cerrar sesión', language: 'Idioma',
    eaOn: 'EA activo', eaOff: 'EA sin señal',
    eaOnTitle: 'Cuenta conectada', eaOffTitle: 'Cuenta sin señal',
  },
  en: {
    dashboard: 'Dashboard', accounts: 'Accounts', manager: 'Guardian', copy: 'Copy', bots: 'My robots', support: 'Support', admin: 'Admin',
    home: 'Home', plans: 'Plans', ambassadors: 'Ambassadors', guide: 'Guide',
    login: 'Sign in', signup: 'Start free',
    myAccount: 'My account', myPlan: 'My plan', referrals: 'Referrals', adminPanel: 'Admin panel', academy: 'Onyx Academy',
    signout: 'Sign out', language: 'Language',
    eaOn: 'EA live', eaOff: 'EA offline',
    eaOnTitle: 'Account connected', eaOffTitle: 'Account not reporting',
  },
  zh: {
    dashboard: '面板', accounts: '账户', manager: 'Guardian', copy: 'Copy', bots: '我的机器人', support: '支持', admin: '管理',
    home: '首页', plans: '套餐', ambassadors: '大使', guide: '指南',
    login: '登录', signup: '免费开始',
    myAccount: '我的账户', myPlan: '我的套餐', referrals: '推荐', adminPanel: '管理面板', academy: 'Onyx Academy',
    signout: '退出登录', language: '语言',
    eaOn: 'EA 在线', eaOff: 'EA 离线',
    eaOnTitle: '账户已连接', eaOffTitle: '账户未上报',
  },
  ja: {
    dashboard: 'ダッシュボード', accounts: 'アカウント', manager: 'Guardian', copy: 'Copy', bots: 'マイロボット', support: 'サポート', admin: '管理',
    home: 'ホーム', plans: 'プラン', ambassadors: 'アンバサダー', guide: 'ガイド',
    login: 'ログイン', signup: '無料で始める',
    myAccount: 'マイアカウント', myPlan: 'マイプラン', referrals: '紹介', adminPanel: '管理パネル', academy: 'Onyx Academy',
    signout: 'ログアウト', language: '言語',
    eaOn: 'EA 稼働中', eaOff: 'EA オフライン',
    eaOnTitle: 'アカウント接続済み', eaOffTitle: 'アカウント未報告',
  },
  pt: {
    dashboard: 'Painel', accounts: 'Contas', manager: 'Guardian', copy: 'Copy', bots: 'Meus robôs', support: 'Suporte', admin: 'Admin',
    home: 'Início', plans: 'Planos', ambassadors: 'Embaixadores', guide: 'Guia',
    login: 'Entrar', signup: 'Começar grátis',
    myAccount: 'Minha conta', myPlan: 'Meu plano', referrals: 'Indicações', adminPanel: 'Painel de admin', academy: 'Onyx Academy',
    signout: 'Sair', language: 'Idioma',
    eaOn: 'EA ativo', eaOff: 'EA offline',
    eaOnTitle: 'Conta conectada', eaOffTitle: 'Conta sem sinal',
  },
  vi: {
    dashboard: 'Bảng điều khiển', accounts: 'Tài khoản', manager: 'Guardian', copy: 'Copy', bots: 'Robot của tôi', support: 'Hỗ trợ', admin: 'Quản trị',
    home: 'Trang chủ', plans: 'Gói', ambassadors: 'Đại sứ', guide: 'Hướng dẫn',
    login: 'Đăng nhập', signup: 'Bắt đầu miễn phí',
    myAccount: 'Tài khoản của tôi', myPlan: 'Gói của tôi', referrals: 'Giới thiệu', adminPanel: 'Bảng quản trị', academy: 'Onyx Academy',
    signout: 'Đăng xuất', language: 'Ngôn ngữ',
    eaOn: 'EA hoạt động', eaOff: 'EA ngoại tuyến',
    eaOnTitle: 'Tài khoản đã kết nối', eaOffTitle: 'Tài khoản không báo cáo',
  },
};
