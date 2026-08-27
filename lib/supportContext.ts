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
