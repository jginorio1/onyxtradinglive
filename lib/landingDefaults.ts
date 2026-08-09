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
    { t_es: 'Conecta tu plataforma', t_en: 'Connect your platform', d_es: 'Elige MetaTrader o cTrader, instala Onyx Connect y pega tu API key. Solo lectura.', d_en: 'Pick MetaTrader or cTrader, install Onyx Connect and paste your API key. Read-only.' },
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

// ===================== FAQ por página (semilla del editor) =====================
// Filas [q_es, a_es, q_en, a_en]. Alineado con el texto de cada página.
export const DEFAULT_FAQ: Record<string, [string, string, string, string][]> = {
  landing: [
    ['¿Con qué brokers y prop firms funciona?', 'Con cualquier cuenta de MetaTrader (MT4/MT5) o cTrader: FTMO, FundedNext, The5ers, FundingPips y tu bróker de siempre. Tu cuenta de fondeo usa una de esas plataformas, así que se conecta igual.', 'Which brokers and prop firms does it work with?', 'Any MetaTrader (MT4/MT5) or cTrader account: FTMO, FundedNext, The5ers, FundingPips and your usual broker. Your funded account uses one of those platforms, so it connects the same way.'],
    ['¿Es seguro conectar mi cuenta?', 'Sí. La conexión es de solo lectura: Onyx lee tu historial pero nunca puede operar, retirar ni mover tus fondos.', 'Is it safe to connect my account?', 'Yes. The connection is read-only: Onyx reads your history but can never trade, withdraw or move your funds.'],
    ['¿Necesito saber programar?', 'No. Instalas el connector, pegas tu API key y listo. Te guiamos paso a paso; no hay que tocar código.', 'Do I need to know how to code?', "No. Install the connector, paste your API key and you're done. We guide you step by step — no code required."],
    ['¿Onyx opera por mí o hace trades solo?', 'No. Onyx nunca ejecuta operaciones ni toca tu dinero. Analiza tu historial y, con Onyx Guardian, te avisa o bloquea el gráfico si te saltas tus reglas. Tú siempre tienes el control.', 'Does Onyx trade for me or place trades on its own?', "No. Onyx never places trades or touches your money. It analyzes your history and, with Onyx Guardian, warns you or locks the chart if you break your own rules. You're always in control."],
    ['¿Qué es Onyx Guardian?', 'Tu gestor de riesgo automático: defines tu pérdida máxima diaria, número de operaciones, horarios y las reglas de tu prop firm, y Onyx te frena antes de romperlas. Ideal para pasar y conservar cuentas de fondeo.', 'What is Onyx Guardian?', 'Your automatic risk manager: set your max daily loss, number of trades, trading hours and your prop-firm rules, and Onyx stops you before you break them. Perfect for passing and keeping funded accounts.'],
    ['¿Hay un plan gratis?', 'Sí. Empiezas gratis, sin tarjeta, con 1 cuenta y las estadísticas básicas. Subes de plan solo cuando lo necesites.', 'Is there a free plan?', 'Yes. Start free, no card, with 1 account and the basic stats. Upgrade only when you need to.'],
    ['¿Puedo copiar operaciones entre mis cuentas?', 'Sí, con el copy trading integrado: replicas de una cuenta maestra a varias esclavas, con control de riesgo por cada enlace. Disponible según tu plan.', 'Can I copy trades between my accounts?', 'Yes, with built-in copy trading: replicate from a master account to several slaves, with per-link risk control. Available depending on your plan.'],
    ['¿Puedo ejecutar señales de TradingView?', 'Sí. Tus alertas de TradingView pueden abrir la operación en tu cuenta real a través de tu EA de Onyx, con tope de lote y símbolos permitidos. El Guardian sigue protegiéndote. En planes de pago.', 'Can I execute TradingView signals?', 'Yes. Your TradingView alerts can open the trade in your real account through your Onyx EA, with a lot cap and allowed symbols. Guardian keeps protecting you. On paid plans.'],
    ['¿Puedo seguir mis robots (EAs) por separado?', 'Sí. En Mis robots, Onyx separa cada EA por su magic number y te muestra el rendimiento de cada uno por cuenta, con tres estados: operando, en línea o sin actividad. Solo los monitorea; nunca los enciende ni los apaga.', 'Can I track my robots (EAs) separately?', 'Yes. In My robots, Onyx separates each EA by its magic number and shows each one\'s performance per account, with three states: running, online or no activity. It only monitors them; it never starts or stops them.'],
    ['¿Onyx me dice cuánto gano de verdad?', 'Sí. Ganancia neta resta tus gastos —costo de challenges, comisiones de la firma, herramientas y VPS— a tu ganancia de trading, y hasta te calcula el ROI por prop firm. Disponible en planes de pago.', 'Does Onyx show what I actually keep?', 'Yes. Net profit subtracts your costs —challenge fees, firm fees, tools and VPS— from your trading profit, and even computes your ROI per prop firm. Available on paid plans.'],
    ['¿Puedo ponerme metas de ganancia?', 'Sí. Fijas metas semanal, mensual y anual y ves tu progreso y lo que te falta, sumando todas tus cuentas y en tu propia zona horaria. Se guardan en tu cuenta, no en el navegador.', 'Can I set profit goals?', 'Yes. Set weekly, monthly and annual goals and see your progress and what is left, across all your accounts and in your own timezone. They are saved to your account, not the browser.'],
    ['¿Tienen academia o comunidad?', 'Sí. En Onyx Academy aprendes con mentores verificados, cursos y comunidad estilo Skool. Y si eres mentor, puedes crear la tuya y cobrar por ella.', 'Do you have an academy or community?', "Yes. In Onyx Academy you learn with verified mentors, courses and a Skool-style community. And if you're a mentor, you can build your own and charge for it."],
    ['¿Cuántas cuentas puedo conectar?', 'Depende de tu plan: desde 1 cuenta en el plan gratis hasta cuentas ilimitadas. Ves todas juntas en tu portafolio.', 'How many accounts can I connect?', 'Depends on your plan: from 1 account on Free to unlimited accounts. You see them all combined in your portfolio.'],
    ['¿Tienen programa de afiliados o embajadores?', 'Sí. Si tienes comunidad, canal o seguidores, cobras una comisión recurrente por cada persona que se suscriba con tu enlace, mientras siga pagando. Además tu audiencia entra con descuento usando tu código. Míralo en la página de Embajadores.', 'Do you have an affiliate or ambassador program?', 'Yes. If you have a community, channel or followers, you earn a recurring commission for every person who subscribes through your link, for as long as they keep paying. Your audience also gets a discount with your code. Check the Ambassadors page.'],
    ['¿Funciona en el móvil?', 'Sí. El panel se adapta a móvil, tablet y monitores grandes, así que lo revisas desde cualquier dispositivo.', 'Does it work on mobile?', 'Yes. The dashboard adapts to phone, tablet and large monitors, so you can check it from any device.'],
    ['¿En qué se diferencia de un Excel?', 'Onyx sincroniza solo, calcula 15+ métricas, tiene calendario, sesiones y noticias en vivo, costes, fondeo y gráficas modernas. Un Excel no hace nada de eso.', 'How is it different from a spreadsheet?', 'Onyx syncs automatically, computes 15+ metrics, and has a calendar, live sessions and news, costs, prop-firm tracking and modern charts. A spreadsheet does none of that.'],
    ['¿Con qué plataformas funciona?', 'Con MetaTrader 4 y 5 y con cTrader; MatchTrader llega pronto. Al conectar eliges tu plataforma y descargas el conector correcto (EA para MetaTrader, cBot para cTrader). La misma cuenta y clave te valen para todas.', 'Which platforms does it work with?', 'MetaTrader 4 and 5 and cTrader; MatchTrader is coming soon. When you connect you pick your platform and download the right connector (EA for MetaTrader, cBot for cTrader). The same account and key work across all of them.'],
    ['¿Puedo cancelar cuando quiera?', 'Claro. Gestionas tu suscripción desde tu panel y cancelas o cambias de plan en cualquier momento.', 'Can I cancel anytime?', 'Of course. Manage your subscription from your panel and cancel or change plan anytime.'],
    ['¿Qué formas de pago aceptan?', 'Pago seguro con tarjeta a través de Stripe. Tus datos de pago nunca pasan por nuestros servidores.', 'What payment methods do you accept?', 'Secure card payments through Stripe. Your payment data never touches our servers.'],
  ],
  embajadores: [
    ['¿Cuánto dura mi comisión?', 'Mientras tu referido siga pagando su suscripción. No hay límite de meses.', 'How long does my commission last?', 'As long as your referral keeps paying. There is no month cap.'],
    ['¿Cuánto gano por cada referido?', 'Un porcentaje recurrente de cada pago. Empiezas en el nivel Silver y subes a Gold al llegar a 10 referidos activos, con una comisión mayor que se aplica también a los que ya tenías.', 'How much do I earn per referral?', 'A recurring percentage of every payment. You start at Silver and move up to Gold at 10 active referrals, with a higher rate that also applies to the ones you already had.'],
    ['¿Cómo y por dónde me pagan?', 'Por PayPal o USDT, o como crédito en tu plan. Solicitas el pago desde tu panel cuando superes el mínimo.', 'How and where do I get paid?', 'Via PayPal or USDT, or as credit on your plan. You request the payout from your panel once you pass the minimum.'],
    ['¿Cuándo puedo cobrar?', 'Las comisiones se retienen 30 días por si hay reembolsos. Después pasan a disponible y puedes solicitarlas.', 'When can I withdraw?', 'Commissions are held 30 days in case of refunds. After that they become available to request.'],
    ['¿Tiene algún costo ser embajador?', 'No, es gratis. Solo llenas el formulario, te aprobamos y empiezas a compartir tu enlace.', 'Is there any cost to be an ambassador?', 'No, it is free. Just fill the form, get approved and start sharing your link.'],
    ['¿Qué descuento reciben mis seguidores?', 'Entran con el descuento de tu código, un incentivo para que se suscriban con tu enlace y tú cobres por ellos.', 'What discount do my followers get?', "They join with your code's discount — an incentive so they subscribe through your link and you get paid for them."],
    ['¿Dónde veo mis referidos y comisiones?', 'En Mi cuenta → Referidos: ves tus referidos activos y las comisiones pendientes, disponibles y pagadas, con su historial.', 'Where do I see my referrals and commissions?', 'In My account → Referrals: your active referrals and your pending, available and paid commissions, with their history.'],
    ['¿Tengo que ser cliente?', 'No hace falta, pero ayuda: es más fácil recomendar algo que usas todos los días.', 'Do I need to be a customer?', 'Not required, but it helps: it is easier to recommend something you use daily.'],
    ['¿Puedo referirme a mí mismo?', 'No. El sistema no cuenta tu propia suscripción ni las cuentas duplicadas.', 'Can I refer myself?', 'No. The system does not count your own subscription or duplicate accounts.'],
  ],
  invita: [
    ['¿Cuándo recibo el crédito?', 'Cuando tu amigo hace su primer pago y pasa la ventana anti-reembolso. Así evitamos fraudes.', 'When do I get the credit?', 'When your friend makes their first payment and clears the refund window. This prevents fraud.'],
    ['¿Cómo se me da el crédito?', 'Como saldo en tu cuenta: reduce tu próxima factura automáticamente. No hay códigos que teclear.', 'How is the credit given?', 'As account balance: it reduces your next invoice automatically. No codes to type.'],
    ['¿Hay límite de amigos?', 'Puedes invitar a todos los que quieras. Cada amigo que paga te da crédito.', 'Is there a limit of friends?', 'Invite as many as you want. Every friend who pays gives you credit.'],
    ['¿Y si mi amigo cancela o pide reembolso?', 'Si ocurre dentro de la ventana, el crédito se anula. Solo premiamos referidos reales.', 'What if my friend cancels or refunds?', 'If it happens within the window, the credit is voided. We only reward real referrals.'],
    ['¿En qué se diferencia de ser Embajador?', 'Aquí ganas crédito en tu cuenta; como Embajador ganas comisión en efectivo recurrente. Al traer varios amigos te invitamos a dar el salto.', 'How is it different from being an Ambassador?', 'Here you earn account credit; as an Ambassador you earn recurring cash commission. Bring several friends and we invite you to make the jump.'],
    ['¿Puedo invitarme a mí mismo?', 'No. El sistema no cuenta auto-referidos ni cuentas duplicadas.', 'Can I refer myself?', 'No. The system does not count self-referrals or duplicate accounts.'],
  ],
  mentores: [
    ['¿Cuánto cobra Onyx por vender en mi academia?', 'Onyx solo se lleva una comisión según tu plan (la ves en la tabla de arriba) y el resto es tuyo. Sin cuota de montaje ni mensualidad extra por tener tu academia. Cuanto más alto tu plan, menor la comisión.', 'How much does Onyx take for selling in my academy?', 'Onyx only takes a fee based on your plan (shown in the table above) and the rest is yours. No setup fee and no extra monthly charge for running your academy. The higher your plan, the lower the fee.'],
    ['¿Cómo y cuándo recibo mis pagos?', 'Cobras directo por Stripe a tu cuenta conectada. Los pagos de tus alumnos llegan a tu cuenta y Onyx descuenta únicamente su comisión — sin intermediarios ni retrasos por nuestra parte.', 'How and when do I get paid?', "You get paid directly through Stripe into your connected account. Your students' payments land in your account and Onyx only deducts its fee — no middlemen or delays on our side."],
    ['¿Mis alumnos tienen que pagar Onyx aparte?', 'No. Tus alumnos solo te pagan a ti por tu academia. No necesitan una suscripción de Onyx para estar en tu comunidad ni ver tus cursos.', 'Do my students have to pay Onyx separately?', "No. Your students only pay you for your academy. They don't need an Onyx subscription to be in your community or watch your courses."],
    ['¿Necesito saber de tecnología?', 'No. Montas tu academia con un asistente paso a paso: portada, precios, cursos y comunidad. Sin código y sin web que construir.', 'Do I need to be tech-savvy?', 'No. You set up your academy with a step-by-step wizard: cover, pricing, courses and community. No code and no website to build.'],
    ['¿Puedo poner mi propia marca?', 'Sí. Personalizas el nombre, logo, colores y redes de tu academia. Los correos automáticos y los certificados salen con tu marca, no con la de Onyx.', 'Can I use my own branding?', "Yes. You customize your academy's name, logo, colors and social links. Automated emails and certificates go out with your brand, not Onyx's."],
    ['¿Qué puedo vender?', 'Membresías mensuales o anuales, varios niveles, cursos con secciones y hasta clases en vivo. Tú pones los precios y decides qué es gratis y qué es de pago.', 'What can I sell?', "Monthly or annual memberships, multiple tiers, courses with sections and even live classes. You set the prices and decide what's free and what's paid."],
    ['¿Puedo migrar mi comunidad de Skool u otra plataforma?', 'Sí. Onyx Academy funciona como Skool — comunidad, cursos, gamificación y ranking — para que traigas a tu gente sin perder tu formato, y además con las herramientas de trading de Onyx.', 'Can I migrate my community from Skool or another platform?', "Yes. Onyx Academy works like Skool — community, courses, gamification and leaderboard — so you can bring your people over without losing your format, plus Onyx's trading tools."],
    ['¿Funciona en el móvil?', 'Sí. Tu academia funciona en el móvil desde el navegador y se puede instalar como app (PWA): tus alumnos la abren desde el teléfono como cualquier otra app.', 'Does it work on mobile?', 'Yes. Your academy works on mobile from the browser and can be installed as an app (PWA): your students open it from their phone like any other app.'],
    ['¿Qué pasa con reembolsos o alumnos problemáticos?', 'Tienes moderación, control de miembros (silenciar o expulsar) y las reglas de reembolso de Stripe. Tú mandas en tu comunidad.', 'What about refunds or problem students?', "You have moderation, member controls (mute or remove) and Stripe's refund rules. You're in charge of your community."],
    ['¿Puedo dejar que mis alumnos copien mis operaciones?', 'Sí. Activas el copy del mentor y tus alumnos, al suscribirse, replican tus trades escalados a su capital, con Guardian y Stop Loss obligatorios. Nunca ves ni tocas su cuenta, y ellos nunca comparten su contraseña.', 'Can I let my students copy my trades?', "Yes. Turn on mentor copy and your students, on subscribing, replicate your trades scaled to their capital, with Guardian and Stop Loss required. You never see or touch their account, and they never share their password."],
  ],
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

