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

// ===================== FASE 3: textos por página =====================
// Etiqueta legible de cada campo para el editor + valor ES/EN por defecto.
export type PageField = { key: string; label_es: string; label_en: string; es: string; en: string; multiline?: boolean };

export const DEFAULT_PAGES: Record<string, { label_es: string; label_en: string; fields: PageField[] }> = {
  embajadores: {
    label_es: 'Embajadores', label_en: 'Ambassadors',
    fields: [
      { key: 'h1', label_es: 'Título', label_en: 'Title', es: 'Gana dinero cada mes con tu comunidad', en: 'Earn every month with your community' },
      { key: 'sub', label_es: 'Subtítulo', label_en: 'Subtitle', multiline: true, es: 'Recomienda Onyx a tus seguidores y cobra una comisión recurrente mientras sigan suscritos. Sin límite de ganancias.', en: 'Recommend Onyx to your followers and earn a recurring commission for as long as they stay subscribed. No earnings cap.' },
    ],
  },
  invita: {
    label_es: 'Invita y gana', label_en: 'Invite & earn',
    fields: [
      { key: 'h1', label_es: 'Título', label_en: 'Title', es: 'Invita a un amigo y ganen los dos', en: 'Invite a friend and you both win' },
      { key: 'sub', label_es: 'Subtítulo', label_en: 'Subtitle', multiline: true, es: 'Comparte tu enlace de Onyx. Cuando tu amigo se suscribe, tú recibes crédito y él también. Sin trámites, sin códigos que recordar.', en: 'Share your Onyx link. When your friend subscribes, you get credit and so do they. No paperwork, no codes to remember.' },
    ],
  },
  mentores: {
    label_es: 'Mentores', label_en: 'Mentors',
    fields: [
      { key: 'h1a', label_es: 'Título — línea 1', label_en: 'Title — line 1', es: 'Monta tu academia de trading,', en: 'Build your trading academy,' },
      { key: 'h1b', label_es: 'Título — línea 2', label_en: 'Title — line 2', es: 'sin montar tu web.', en: 'without building a website.' },
      { key: 'ctaTitle', label_es: 'Título CTA final', label_en: 'Final CTA title', es: 'Convierte tu comunidad en tu negocio', en: 'Turn your community into your business' },
    ],
  },
  academias: {
    label_es: 'Academias (directorio)', label_en: 'Academies (directory)',
    fields: [
      { key: 'intro', label_es: 'Intro', label_en: 'Intro', multiline: true, es: 'Las academias son privadas. Solo puedes unirte con el código, el enlace o el código QR que te comparta tu mentor.', en: 'Academies are private. You can only join with the code, link or QR your mentor shares with you.' },
      { key: 'codeTitle', label_es: 'Título tarjeta', label_en: 'Card title', es: '¿Tienes un código?', en: 'Have a code?' },
      { key: 'codeText', label_es: 'Texto tarjeta', label_en: 'Card text', multiline: true, es: 'Entra a tu cuenta y pégalo en Dashboard → Onyx Academy → «Unirme a una academia».', en: 'Sign in and paste it in Dashboard → Onyx Academy → “Join an academy”.' },
    ],
  },
  analiza: {
    label_es: 'Analiza gratis', label_en: 'Analyze free',
    fields: [
      { key: 'title', label_es: 'Título', label_en: 'Title', es: 'Analiza tu cuenta gratis 🔍', en: 'Analyze your account free 🔍' },
      { key: 'sub', label_es: 'Subtítulo', label_en: 'Subtitle', multiline: true, es: 'Pega tu reporte de MetaTrader o cTrader (o tu lista de operaciones cerradas) y Onyx AI te dará 3 hallazgos al instante. Sin registro.', en: 'Paste your MetaTrader or cTrader statement (or your list of closed trades) and Onyx AI gives you 3 findings instantly. No signup.' },
      { key: 'placeholder', label_es: 'Placeholder del cuadro', label_en: 'Textarea placeholder', multiline: true, es: 'Pega aquí tus operaciones (par, resultado, hora…) o el texto de tu reporte de MetaTrader o cTrader.', en: 'Paste your trades here (pair, result, time…) or your MetaTrader or cTrader statement text.' },
      { key: 'privacy', label_es: 'Nota de privacidad', label_en: 'Privacy note', es: 'No guardamos lo que pegas.', en: "We don't store what you paste." },
      { key: 'disclaimer', label_es: 'Aviso inferior', label_en: 'Bottom disclaimer', multiline: true, es: 'Onyx analiza tu pasado para darte disciplina. No predice el mercado ni da señales.', en: 'Onyx analyzes your past to give you discipline. It does not predict the market or give signals.' },
    ],
  },
};

// ===================== FASE 4: nav, footer, legales =====================
export const DEFAULT_NAV: { key: string; es: string; en: string }[] = [
  { key: 'features', es: 'Funciones', en: 'Features' },
  { key: 'eco', es: 'Ecosistema', en: 'Ecosystem' },
  { key: 'how', es: 'Cómo funciona', en: 'How it works' },
  { key: 'fondeo', es: 'Fondeo', en: 'Prop firms' },
  { key: 'gestor', es: 'Guardian', en: 'Guardian' },
  { key: 'pricing', es: 'Precios', en: 'Pricing' },
  { key: 'amb', es: 'Embajadores', en: 'Ambassadors' },
  { key: 'faq', es: 'FAQ', en: 'FAQ' },
];

export const DEFAULT_FOOTER = {
  tagline_es: '', tagline_en: '',
  links: [
    { es: 'Inicio', en: 'Home', href: '/' },
    { es: 'Planes', en: 'Plans', href: '/pricing' },
    { es: 'Guía', en: 'Guide', href: '/guia' },
    { es: 'Embajadores', en: 'Ambassadors', href: '/embajadores' },
    { es: 'Invita y gana', en: 'Invite & earn', href: '/invita' },
    { es: 'Contacto', en: 'Contact', href: '/contacto' },
    { es: 'Términos', en: 'Terms', href: '/terms' },
    { es: 'Privacidad', en: 'Privacy', href: '/privacy' },
  ],
};

// Legales en texto plano. El renderer usa: 1ª línea = título (h1),
// líneas que empiezan con "## " = subtítulo, y párrafos separados por línea en blanco.
export const DEFAULT_LEGAL = {
  terms_es: `Términos y Condiciones

## 1. El servicio
Onyx Trading Live ("Onyx") es una herramienta de diario y análisis de trading que se conecta a tus cuentas de MetaTrader (MT4/MT5), cTrader y otras plataformas compatibles en modo solo lectura para mostrar tu historial y estadísticas. Onyx no ejecuta operaciones ni mueve fondos.

## 2. Cuentas
Eres responsable de mantener la confidencialidad de tu cuenta y tu API key. Debes ser mayor de edad para usar el servicio.

## 3. Suscripciones y pagos
Los planes de pago se gestionan a través de Stripe. Las suscripciones se renuevan automáticamente hasta que las canceles. Puedes cancelar en cualquier momento desde tu panel; el acceso continúa hasta el final del periodo pagado. Los reembolsos se evalúan caso por caso.

## 4. Uso aceptable
No puedes usar Onyx para actividades ilegales, ni intentar vulnerar la seguridad de la plataforma o de otros usuarios.

## 5. Sin asesoramiento financiero
Onyx es una herramienta informativa. No constituye asesoramiento financiero ni recomendaciones de inversión. Operar conlleva riesgo de pérdida.

## 6. Limitación de responsabilidad
El servicio se ofrece "tal cual". Onyx no se responsabiliza de pérdidas derivadas del uso de la plataforma, de errores en los datos importados o de interrupciones del servicio.

## 7. Cambios
Podemos actualizar estos términos. Te avisaremos de cambios importantes.

## 8. Contacto
Para cualquier consulta, contáctanos a través del correo indicado en la web.`,
  terms_en: `Terms & Conditions

## 1. The service
Onyx Trading Live ("Onyx") is a trading journal and analytics tool that connects to your MetaTrader (MT4/MT5), cTrader and other supported platform accounts in read-only mode to display your history and statistics. Onyx does not place trades or move funds.

## 2. Accounts
You are responsible for keeping your account and API key confidential. You must be of legal age to use the service.

## 3. Subscriptions & payments
Paid plans are handled through Stripe. Subscriptions renew automatically until cancelled. You can cancel anytime from your panel; access continues until the end of the paid period. Refunds are evaluated case by case.

## 4. Acceptable use
You may not use Onyx for illegal activities, nor attempt to breach the security of the platform or other users.

## 5. No financial advice
Onyx is an informational tool. It does not constitute financial advice or investment recommendations. Trading involves risk of loss.

## 6. Limitation of liability
The service is provided "as is". Onyx is not liable for losses arising from use of the platform, errors in imported data, or service interruptions.

## 7. Changes
We may update these terms. We will notify you of significant changes.

## 8. Contact
For any questions, contact us via the email listed on the website.`,
  privacy_es: `Política de Privacidad

## 1. Qué datos recogemos
Recogemos tu email (para tu cuenta), los datos de tu historial de trading que envía el connector (operaciones, balance, cuenta) y datos de pago gestionados por Stripe (no almacenamos números de tarjeta).

## 2. Para qué los usamos
Usamos tus datos para mostrarte tus estadísticas, gestionar tu suscripción y mejorar el servicio. No vendemos tus datos a terceros.

## 3. Dónde se guardan
Los datos se almacenan de forma segura en nuestra base de datos (Supabase). Los pagos se procesan a través de Stripe.

## 4. Terceros
Usamos proveedores de confianza: Supabase (base de datos), Vercel (hosting) y Stripe (pagos). Cada uno tiene sus propias políticas de privacidad.

## 5. Seguridad
La conexión con tu plataforma (MetaTrader, cTrader…) es de solo lectura. Aplicamos medidas para proteger tu información, aunque ningún sistema es 100% infalible.

## 6. Tus derechos
Puedes acceder, corregir o eliminar tus datos y tu cuenta en cualquier momento contactándonos.

## 7. Cookies
Usamos cookies esenciales para mantener tu sesión iniciada.

## 8. Contacto
Para ejercer tus derechos o cualquier consulta, contáctanos a través del correo indicado en la web.`,
  privacy_en: `Privacy Policy

## 1. What data we collect
We collect your email (for your account), the trading history data sent by the connector (trades, balance, account) and payment data handled by Stripe (we do not store card numbers).

## 2. How we use it
We use your data to show your statistics, manage your subscription and improve the service. We do not sell your data to third parties.

## 3. Where it is stored
Data is stored securely in our database (Supabase). Payments are processed through Stripe.

## 4. Third parties
We use trusted providers: Supabase (database), Vercel (hosting) and Stripe (payments). Each has its own privacy policy.

## 5. Security
The connection to your platform (MetaTrader, cTrader…) is read-only. We apply measures to protect your information, although no system is 100% foolproof.

## 6. Your rights
You can access, correct or delete your data and account at any time by contacting us.

## 7. Cookies
We use essential cookies to keep your session logged in.

## 8. Contact
To exercise your rights or for any questions, contact us via the email listed on the website.`,
};

