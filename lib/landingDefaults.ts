import type { CardRow } from '@/lib/landingContent';

// Textos actuales del landing (Fase 2) en forma editable, ES+EN, para SEMBRAR
// el Landing Builder. Son solo el punto de partida del editor: el landing sigue
// usando su propio texto en código como fallback si no hay override guardado.
// Mantener alineado con app/page.tsx si se cambia el copy allí.

export const DEFAULT_ECO = {
  badge_es: '🧩 Mucho más que un diario', badge_en: '🧩 Much more than a journal',
  t_es: 'Todo el ecosistema Onyx', t_en: 'The whole Onyx ecosystem',
  s_es: 'Un solo lugar para analizar, proteger, aprender y hacer crecer tu trading. Todo conectado a tu misma cuenta.',
  s_en: 'One place to analyze, protect, learn and grow your trading. All wired to your same account.',
  cards: [
    { i: '🛡️', t_es: 'Onyx Guardian', t_en: 'Onyx Guardian', d_es: 'Gestiona y frena tus operaciones según tu plan: break even real, trailing, parciales, límites de fondeo y bloqueo por noticias.', d_en: 'Manages and brakes your trades to your plan: real break even, trailing, partials, funded-account limits and news blackout.' },
    { i: '🔁', t_es: 'Copy trading', t_en: 'Copy trading', d_es: 'Copia de una cuenta maestra a varias, con tus límites de riesgo por enlace. Nunca se activa solo: tú decides.', d_en: 'Copy from a master account to several, with your own per-link risk limits. Never auto-activates: you decide.' },
    { i: '📈', t_es: 'Señales de TradingView', t_en: 'TradingView signals', d_es: 'Tus alertas de TradingView abren la operación en tu cuenta real vía tu EA, con tope de lote y símbolos. El Guardian te sigue protegiendo.', d_en: 'Your TradingView alerts open the trade in your real account via your EA, with a lot cap and symbols. Guardian keeps protecting you.' },
    { i: '🎓', t_es: 'Onyx Academy', t_en: 'Onyx Academy', d_es: 'Comunidad y mentoría estilo Skool: cursos, clases en vivo, feed, retos y certificados. Los mentores cobran con Stripe.', d_en: 'Skool-style community and mentorship: courses, live classes, feed, challenges and certificates. Mentors get paid with Stripe.' },
    { i: '🤖', t_es: 'Onyx AI', t_en: 'Onyx AI', d_es: 'Analiza tu operativa, lee tu reporte y te da hallazgos claros. Nunca da señales ni promete ganancias.', d_en: 'Analyzes your trading, reads your statement and gives you clear findings. Never gives signals or promises profit.' },
    { i: '📲', t_es: 'Alertas por Telegram', t_en: 'Telegram alerts', d_es: 'Avisos de fondeo, Guardian, noticias, meta alcanzada y resumen diario, directo a tu Telegram.', d_en: 'Funding, Guardian, news, target reached and daily summary alerts, straight to your Telegram.' },
    { i: '🏆', t_es: 'Seguimiento de reto', t_en: 'Challenge tracker', d_es: 'Vigila las reglas de tu prop firm en vivo: objetivo, pérdida diaria y total, con margen de seguridad.', d_en: 'Watch your prop-firm rules live: target, daily and total loss, with a safety margin.' },
  ] as CardRow[],
};

export const DEFAULT_FEATURES = {
  t_es: 'Todo lo que necesitas para mejorar', t_en: 'Everything you need to improve',
  cards: [
    { i: '🔗', t_es: 'Conexión multiplataforma', t_en: 'Multi-platform connection', d_es: 'MetaTrader 4 y 5, cTrader y pronto MatchTrader. Vincula tus cuentas y sincroniza el historial automáticamente, sin subir nada a mano.', d_en: 'MetaTrader 4 & 5, cTrader and MatchTrader soon. Link your accounts and sync your history automatically — nothing to upload by hand.' },
    { i: '📈', t_es: 'Estadísticas avanzadas', t_en: 'Advanced stats', d_es: 'Win rate, profit factor, expectancy, payoff, drawdown, break even y mucho más.', d_en: 'Win rate, profit factor, expectancy, payoff, drawdown, break even and much more.' },
    { i: '🗓️', t_es: 'Calendario de resultados', t_en: 'Results calendar', d_es: 'Visualiza tu P&L por día, mes y año con un calendario tipo mapa de calor.', d_en: 'See your P&L by day, month and year with a heatmap-style calendar.' },
    { i: '🗂️', t_es: 'Multi-cuenta y portafolio', t_en: 'Multi-account & portfolio', d_es: 'Gestiona varias cuentas (real, demo, fondeo) y ve tu portafolio completo sumado.', d_en: 'Manage several accounts (live, demo, funded) and see your full portfolio combined.' },
    { i: '🌍', t_es: 'Sesiones, días y pares', t_en: 'Sessions, days & pairs', d_es: 'Descubre tus mejores y peores horas, sesiones, días y pares.', d_en: 'Discover your best and worst hours, sessions, days and pairs.' },
    { i: '🏆', t_es: 'Seguimiento de fondeo', t_en: 'Prop-firm tracking', d_es: 'Sigue tu drawdown y objetivo de FTMO y otras prop firms en tiempo real.', d_en: 'Track your drawdown and target for FTMO and other prop firms in real time.' },
  ] as CardRow[],
};

export const DEFAULT_HOW = {
  t_es: 'Listo en 3 minutos', t_en: 'Ready in 3 minutes',
  steps: [
    { t_es: 'Crea tu cuenta', t_en: 'Create your account', d_es: 'Regístrate gratis con tu email. Sin tarjeta.', d_en: 'Sign up free with your email. No card.' },
    { t_es: 'Conecta tu plataforma', t_en: 'Connect your platform', d_es: 'Elige MetaTrader o cTrader, instala el Onyx Connector y pega tu API key. Solo lectura.', d_en: 'Pick MetaTrader or cTrader, install the Onyx Connector and paste your API key. Read-only.' },
    { t_es: 'Analiza y mejora', t_en: 'Analyze & improve', d_es: 'Tus operaciones aparecen al instante con todas las estadísticas.', d_en: 'Your trades show up instantly with all the stats.' },
  ] as CardRow[],
};

export const DEFAULT_TRUST = {
  es: ['✅ MT4, MT5 y cTrader', '🔒 Conexión de solo lectura', '💳 Pagos seguros con Stripe'],
  en: ['✅ MT4, MT5 & cTrader', '🔒 Read-only connection', '💳 Secure payments with Stripe'],
};

export const DEFAULT_CTA = {
  t_es: 'Empieza a operar con datos, no con memoria', t_en: 'Trade with data, not memory',
  btn_es: 'Crear cuenta gratis', btn_en: 'Create free account',
};
