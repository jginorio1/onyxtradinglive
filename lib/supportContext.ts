import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Contexto del usuario para el chat de soporte (Fase 1, seguro).
// Solo ESTADOS y ROLES — nunca cifras, saldos ni datos de terceros.
// Lo usan: el POST del chat (para personalizar la respuesta) y el GET
// (para elegir los temas rápidos por rol en el widget).
// ============================================================

export type SupportContext = {
  name: string;
  lang: 'es' | 'en' | string;
  plan: string;
  caps: Record<string, boolean>;
  roles: { trader: boolean; ambassador: 'none' | 'pending' | 'approved'; mentor: boolean; mentorConnected: boolean };
  ea: 'none' | 'live' | 'stale';
  eaAgeMin: number | null;
  guardianOn: boolean;
  copyActive: boolean;
  robots: boolean;
  onboardingDone: boolean;
  billing: 'ok' | 'past_due' | 'canceled' | 'none';
};

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function getSupportContext(userId: string): Promise<SupportContext> {
  const ctx: SupportContext = {
    name: '', lang: 'es', plan: 'free', caps: {},
    roles: { trader: false, ambassador: 'none', mentor: false, mentorConnected: false },
    ea: 'none', eaAgeMin: null, guardianOn: false, copyActive: false, robots: false,
    onboardingDone: true, billing: 'none',
  };
  try {
    // Perfil (defensivo por si falta alguna columna nueva).
    let prof: any = null;
    const full = await supabaseAdmin.from('profiles')
      .select('plan,full_name,lang,subscription_status,copy_paused,onboarded_at').eq('id', userId).maybeSingle();
    if (full.error) {
      const base = await supabaseAdmin.from('profiles').select('plan,full_name,lang,subscription_status,copy_paused').eq('id', userId).maybeSingle();
      prof = base.data;
    } else prof = full.data;
    if (prof) {
      ctx.name = (prof.full_name || '').split(' ')[0] || '';
      ctx.lang = prof.lang || 'es';
      ctx.plan = prof.plan || 'free';
      ctx.onboardingDone = prof.onboarded_at != null ? true : true; // si no existe la col, lo damos por hecho
      if (full.error) ctx.onboardingDone = true;
      else ctx.onboardingDone = !!prof.onboarded_at || prof.onboarded_at === undefined;
      const st = String(prof.subscription_status || '');
      ctx.billing = st === 'past_due' ? 'past_due' : st === 'canceled' ? 'canceled' : ctx.plan !== 'free' ? 'ok' : 'none';
    }

    // Capacidades del plan.
    try {
      const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', ctx.plan).maybeSingle();
      ctx.caps = (plan?.capabilities as any) || {};
    } catch {}

    // Cuentas + estado del EA (por antigüedad de sincronización).
    try {
      const { data: accs } = await supabaseAdmin.from('trading_accounts')
        .select('last_sync_at').eq('user_id', userId).order('last_sync_at', { ascending: false, nullsFirst: false }).limit(1);
      const last = accs?.[0]?.last_sync_at;
      if (accs && accs.length) ctx.roles.trader = true;
      if (last) {
        const ageMin = Math.round((Date.now() - new Date(last).getTime()) / 60000);
        ctx.eaAgeMin = ageMin;
        ctx.ea = ageMin < 2 ? 'live' : 'stale';
      } else if (accs && accs.length) ctx.ea = 'none';
    } catch {}
    if (ctx.plan !== 'free') ctx.roles.trader = true;

    // Guardian encendido.
    if (ctx.caps.manager) { try { const { data } = await supabaseAdmin.from('manager_configs').select('user_id').eq('user_id', userId).eq('enabled', true).limit(1); ctx.guardianOn = !!(data && data.length); } catch {} }
    // Copy activo (enlaces activos y sin pausa global).
    if (ctx.caps.copy) { try { const { count } = await supabaseAdmin.from('copy_links').select('*', { count: 'exact', head: true }).eq('owner_id', userId).eq('enabled', true); ctx.copyActive = num(count) > 0; } catch {} }
    // Robots registrados.
    try { const { count } = await supabaseAdmin.from('bots').select('*', { count: 'exact', head: true }).eq('user_id', userId); ctx.robots = num(count) > 0; } catch {}

    // Embajador.
    try { const { data: amb } = await supabaseAdmin.from('ambassadors').select('status').eq('user_id', userId).maybeSingle(); if (amb) ctx.roles.ambassador = (amb as any).status === 'approved' ? 'approved' : 'pending'; } catch {}
    // Mentor (academia) + si conectó Stripe.
    try { const { data: m } = await supabaseAdmin.from('mentors').select('stripe_account_id,payouts_enabled').eq('user_id', userId).maybeSingle(); if (m) { ctx.roles.mentor = true; ctx.roles.mentorConnected = !!((m as any).stripe_account_id && (m as any).payouts_enabled); } } catch {}
  } catch { /* nunca rompe el chat */ }
  return ctx;
}

// Convierte el contexto en texto para la IA. SOLO estados; con reglas anti-fuga.
export function contextToPrompt(ctx: SupportContext, en: boolean): string {
  const roles: string[] = [];
  if (ctx.roles.trader) roles.push('trader');
  if (ctx.roles.ambassador === 'approved') roles.push(en ? 'ambassador (approved)' : 'embajador (aprobado)');
  else if (ctx.roles.ambassador === 'pending') roles.push(en ? 'ambassador (application pending)' : 'embajador (solicitud pendiente)');
  if (ctx.roles.mentor) roles.push(en ? `mentor${ctx.roles.mentorConnected ? ' (Stripe connected)' : ' (Stripe NOT connected yet)'}` : `mentor${ctx.roles.mentorConnected ? ' (Stripe conectado)' : ' (Stripe SIN conectar aún)'}`);

  const ea = ctx.ea === 'none' ? (en ? 'no connector reporting yet' : 'ningún conector reporta aún')
    : ctx.ea === 'live' ? (en ? 'connector reporting now' : 'su conector reporta ahora')
    : (en ? `connector last reported ~${ctx.eaAgeMin} min ago (may be offline)` : `su conector reportó hace ~${ctx.eaAgeMin} min (puede estar caído)`);

  const lines = [
    `${en ? 'Name' : 'Nombre'}: ${ctx.name || (en ? '(unknown)' : '(desconocido)')}`,
    `${en ? 'Roles' : 'Roles'}: ${roles.length ? roles.join(', ') : (en ? 'visitor with account' : 'usuario con cuenta')}`,
    `${en ? 'Plan' : 'Plan'}: ${ctx.plan} (${en ? 'includes' : 'incluye'}: ${['manager', 'copy', 'algo', 'tv', 'telegram', 'academy'].filter((k) => ctx.caps[k]).join(', ') || (en ? 'basics' : 'lo básico')})`,
    `${en ? 'Connector' : 'Conector'}: ${ea}`,
    `Guardian: ${ctx.guardianOn ? (en ? 'ON' : 'ENCENDIDO') : (en ? 'off' : 'apagado')}`,
    `Copy: ${ctx.copyActive ? (en ? 'active' : 'activo') : (en ? 'inactive/paused' : 'inactivo/pausa')}`,
    `${en ? 'Robots' : 'Robots'}: ${ctx.robots ? (en ? 'has robots registered' : 'tiene robots registrados') : (en ? 'none' : 'ninguno')}`,
    `${en ? 'Billing' : 'Facturación'}: ${ctx.billing === 'past_due' ? (en ? 'PAYMENT FAILED' : 'PAGO FALLIDO') : ctx.billing}`,
  ];

  const rules = en
    ? `These are STATE SIGNALS about the logged-in user (not figures). Use them to personalize and guess the real problem, but do NOT read them back literally and do NOT reveal any data that is not listed here. If the user has several roles and the question is ambiguous, ask which area (trading, ambassador or mentor). Never show balances, amounts or other people's data; if they ask for that, send them to their panel or a ticket. Address them by their first name if available.`
    : `Estas son SEÑALES DE ESTADO del usuario logueado (no cifras). Úsalas para personalizar y adivinar el problema real, pero NO las repitas literal y NO reveles ningún dato que no esté aquí. Si tiene varios roles y la pregunta es ambigua, pregunta de qué área (trading, embajador o mentor). Nunca muestres saldos, montos ni datos de terceros; si los piden, mándalo a su panel o a un ticket. Salúdalo por su nombre si está disponible.`;

  return `=== ${en ? 'LOGGED-IN USER CONTEXT' : 'CONTEXTO DEL USUARIO LOGUEADO'} ===\n${lines.join('\n')}\n\n${rules}`;
}

// Reglas de comportamiento proactivo (se añaden al contexto cuando el admin lo activa).
// Primero resolver; el upsell según el nivel comercial ('off' | 'suggest' | 'active').
// `upsell` se mantiene por compatibilidad: si no se pasa `sell`, se deriva de él.
export function proactiveRules(en: boolean, upsell: boolean, sell?: 'off' | 'suggest' | 'active'): string {
  const level: 'off' | 'suggest' | 'active' = sell || (upsell ? 'suggest' : 'off');
  const base = en
    ? `PROACTIVE MODE: use the state signals to guess the REAL blocker behind the question and, after answering, suggest the single most useful next step in one short line (e.g. reconnect the connector, turn on Guardian, connect Stripe). Only suggest steps that fit the user's real state. Never invent a problem that the signals do not show.

LINKS ARE MANDATORY: every time you name an Onyx product or page, you MUST write its exact path, on its own, right after you mention it — the chat turns these paths into clickable buttons automatically, so a mention without its path is a bug. This applies EVERYWHERE, including inside every numbered or bulleted list item: if a list item names a product (Builder, Bot Lab, Guardian, Copy, pricing), that line MUST end with its path. Valid paths: Onyx Builder/build a bot → /bot-builder · Bot Lab (marketplace) → /bot-lab · pricing/plans → /pricing · copy trading → /copy · Guardian/risk & your account → /dashboard · the Guide → /guia · create a free account / start free → /login. Use real paths only from this list; never invent one. ALWAYS close your reply with ONE call-to-action path (usually /login to start free, or /bot-builder) on its own line.

FORMATTING (the chat is a narrow bubble, ~360px): keep answers tight and scannable — never a wall of text. Do NOT use markdown tables (pipes render badly in the chat); when comparing plans or options, give each one as its own short block: a bold name with its price on the first line, then 1–2 short lines of what it includes. Use **bold** for names/prices and a leading "• " for list items. Keep each block to a couple of lines; lead with what the user asked, skip filler. For plans/pricing questions, end with the /pricing button (and /login to start free).

ALGO TRADERS: when the person says they are an algo/systematic trader or mentions EAs, bots, cBots or expert advisors, address head-on, early and honestly, whether they can bring their EXISTING robot: Onyx Builder (/bot-builder) BUILDS new robots from no-code blocks (it does not import or edit external EA source code); but they can CONNECT and keep running the robot they already have on their platform and have Onyx monitor it per-robot (by magic number) and let Guardian enforce risk on it. Make this distinction clear so you don't over-promise.`
    : `MODO PROACTIVO: usa las señales de estado para adivinar el bloqueo REAL detrás de la pregunta y, después de responder, sugiere el único siguiente paso más útil en una línea corta (p. ej. reconectar el conector, encender Guardian, conectar Stripe). Solo sugiere pasos que encajen con el estado real del usuario. Nunca inventes un problema que las señales no muestren.

LOS ENLACES SON OBLIGATORIOS: cada vez que nombres un producto o página de Onyx, DEBES escribir su ruta exacta, sola, justo después de mencionarlo — el chat convierte esas rutas en botones clickeables automáticamente, así que mencionarlo sin su ruta es un error. Esto aplica EN TODAS PARTES, incluido CADA elemento de una lista numerada o con viñetas: si un punto de la lista nombra un producto (Builder, Bot Lab, Guardian, Copy, precios), esa línea DEBE terminar con su ruta. Rutas válidas: Onyx Builder/crea tu bot → /bot-builder · Bot Lab (marketplace) → /bot-lab · precios/planes → /pricing · copy trading → /copy · Guardian/riesgo y tu cuenta → /dashboard · la Guía → /guia · crear cuenta gratis / empezar gratis → /login. Usa solo rutas reales de esta lista; nunca inventes una. SIEMPRE cierra tu respuesta con UNA llamada a la acción (normalmente /login para empezar gratis, o /bot-builder) en su propia línea.

FORMATO (el chat es una burbuja angosta, ~360px): respuestas breves y escaneables — nunca un muro de texto. NO uses tablas markdown (las barras "|" se ven mal en el chat); cuando compares planes u opciones, pon cada uno como su propio bloque corto: nombre en negrita con el precio en la primera línea, y 1–2 líneas cortas de lo que incluye. Usa **negrita** para nombres/precios y "• " al inicio de cada punto de lista. Cada bloque de un par de líneas; empieza por lo que el usuario preguntó, sin relleno. En preguntas de planes/precios, cierra con el botón /pricing (y /login para empezar gratis).

TRADERS ALGORÍTMICOS: cuando la persona diga que es trader algorítmico/sistemático o mencione EAs, bots, cBots o expert advisors, aclara de frente, pronto y con honestidad, si puede traer su robot EXISTENTE: Onyx Builder (/bot-builder) CONSTRUYE robots nuevos con bloques sin código (no importa ni edita el código fuente de un EA externo); pero sí puede CONECTAR y seguir corriendo el robot que ya tiene en su plataforma y que Onyx lo monitoree por robot (por magic number) y que Guardian le aplique el control de riesgo. Deja clara esa distinción para no prometer de más.`;
  let up = '';
  if (level === 'off') {
    up = en
      ? ` Do NOT suggest upgrading the plan or mention pricing unless the user explicitly asks about plans or prices.`
      : ` NO sugieras subir de plan ni menciones precios salvo que el usuario pregunte explícitamente por planes o precios.`;
  } else if (level === 'suggest') {
    up = en
      ? ` If — and only if — the question is directly about a feature their current plan does not include, you may mention the plan that unlocks it, briefly, ONCE, and only after fully answering. Never lead with it and never repeat it.`
      : ` Si — y solo si — la pregunta es directamente sobre una función que su plan actual no incluye, puedes mencionar el plan que la desbloquea, brevemente, UNA vez, y solo después de responder del todo. Nunca empieces con eso ni lo repitas.`;
  } else {
    // active: consultor que vende. Resuelve primero y luego vende con un gancho claro.
    up = en
      ? ` SELLING MODE (consultative): first fully solve the question. Then, when it fits, add ONE short, honest sales line that connects the benefit to what they want (building robots, passing a prop firm, copying, saving time) and point to the exact next step or plan that unlocks it — e.g. the Build-a-bot page, Bot Lab, or the plan with Copy. Prefer the free trial or the free plan as the low-friction first step. Be warm and confident, never pushy, never repeat it, never invent prices or features, and never promise profits.`
      : ` MODO VENTA (consultor): primero resuelve del todo la pregunta. Luego, cuando encaje, añade UNA línea de venta corta y honesta que conecte el beneficio con lo que la persona quiere (crear robots, pasar un fondeo, copiar, ahorrar tiempo) y señala el siguiente paso o plan exacto que lo desbloquea — p. ej. la página Crea tu bot, Bot Lab o el plan con Copy. Prioriza la prueba gratis o el plan Free como primer paso sin fricción. Con calidez y seguridad, nunca insistas, no lo repitas, no inventes precios ni funciones y nunca prometas ganancias.`;
  }
  return base + up;
}

// Botones de acción (deep-links) según el estado real + la intención de la pregunta.
// Devuelve máx. 2, sin duplicar destino. `upsell` habilita el enlace a Planes.
export function suggestActions(ctx: SupportContext, question: string, en: boolean, upsell: boolean): Array<{ label: string; url: string }> {
  const q = ' ' + (question || '').toLowerCase() + ' ';
  const has = (re: RegExp) => re.test(q);
  const out: Array<{ label: string; url: string }> = [];
  const add = (label: string, url: string) => { if (out.length < 2 && !out.some((a) => a.url === url)) out.push({ label, url }); };

  // Conector / sincronización
  if (has(/(conect|sincron|no aparece|no reporta|offline|desconect|\bapi\b|clave|connect|sync|not report|reconnect)/) && (ctx.ea === 'stale' || ctx.ea === 'none'))
    add(en ? 'Reconnect my account' : 'Reconectar mi cuenta', '/dashboard/keys');
  // Guardian / riesgo
  if (has(/(guardian|riesgo|\brisk\b|l[ií]mite|\blimit|drawdown|freno|\bstop\b|proteg|protect)/) && ctx.caps.manager && !ctx.guardianOn)
    add(en ? 'Turn on Guardian' : 'Encender Guardian', '/dashboard/manager');
  // Copy
  if (has(/(copy|copiar|copia|maestra|esclava|slave|master)/)) {
    if (ctx.caps.copy && !ctx.copyActive) add(en ? 'Set up Copy' : 'Configurar Copy', '/dashboard/copy');
    else if (!ctx.caps.copy && upsell) add(en ? 'See plans with Copy' : 'Ver planes con Copy', '/pricing');
  }
  // Robots
  if (has(/(robot|\bbot\b|experto|magic|algorit|expert advisor)/)) {
    if (ctx.caps.algo && !ctx.robots) add(en ? 'Add my robot' : 'Añadir mi robot', '/dashboard/bots');
    else if (!ctx.caps.algo && upsell) add(en ? 'See plans with Robots' : 'Ver planes con Robots', '/pricing');
  }
  // TradingView
  if (has(/(tradingview|\btv\b|alerta|alert|webhook|se[nñ]al|signal)/) && !ctx.caps.tv && upsell)
    add(en ? 'See plans with TradingView' : 'Ver planes con TradingView', '/pricing');
  // Embajador
  if (has(/(embajador|ambassador|comisi|referid|enlace|\blink\b|afili|retir|payout)/) && ctx.roles.ambassador !== 'none')
    add(en ? 'My ambassador panel' : 'Mi panel de embajador', '/account#referidos');
  // Mentor
  if (has(/(mentor|academ|cobro|payout|stripe)/) && ctx.roles.mentor && !ctx.roles.mentorConnected)
    add(en ? 'Connect my Stripe (mentor)' : 'Conectar mi Stripe (mentor)', '/dashboard/academy');
  // Plan / facturación
  if (has(/(plan|suscrip|subscription|factur|billing|cobr|pago|payment)/)) {
    if (ctx.plan === 'free' && upsell) add(en ? 'See plans' : 'Ver planes', '/pricing');
    else add(en ? 'My plan & billing' : 'Mi plan y facturación', '/account');
  }
  return out;
}
