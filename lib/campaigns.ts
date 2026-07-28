import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmailId } from '@/lib/mail';
import { resolveSegment, type Recipient } from '@/lib/segments';

// ============================================================
// Motor de campañas de correo. Dos modos:
//  · Automáticas (trigger / scheduled) → las corre un cron a diario.
//  · Manuales (promos, noticias) → se envían al pulsar "Enviar" en el panel.
// Reglas de oro: respeta el opt-out (se aplica en segments.ts), nunca envía
// dos veces la misma campaña de disparo al mismo usuario (campaign_sends), y
// pone un tope por corrida para no exceder el tiempo del cron.
// ============================================================

const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');
const PER_RUN = 200;               // tope de correos por corrida del cron
const SCHEDULED_INTERVAL_DAYS = 6; // "semanal" con margen

export type CampaignRow = {
  id: string; key: string | null; name: string; kind: 'trigger' | 'scheduled' | 'manual';
  segment: string; subject_es: string; body_es: string; subject_en: string; body_en: string;
  enabled: boolean; trigger: any; schedule: string; scheduled_at: string | null; last_run_at: string | null;
};

// --- Plantillas por defecto de las campañas automáticas. Se crean la primera
// vez (idempotente por `key`). El texto es editable luego desde el panel.
export const DEFAULT_CAMPAIGNS: Array<Partial<CampaignRow>> = [
  {
    key: 'no_connect', name: 'No conectó su cuenta', kind: 'trigger', segment: 'no_connect', trigger: { days: 3, maxDays: 60 },
    subject_es: '{{nombre}}, conecta tu cuenta en 2 minutos 👀',
    body_es: `Hola {{nombre}},\n\nVimos que aún no conectas tu MetaTrader a Onyx. Es lo que desbloquea tus números en vivo y a **Onyx Guardian** cuidando tu riesgo.\n\nToma unos 2 minutos:\n{{sitio}}/guia/conectar-cuenta\n\n¿Te atascaste? Responde a este correo y te ayudamos.`,
    subject_en: '{{nombre}}, connect your account in 2 minutes 👀',
    body_en: `Hi {{nombre}},\n\nWe noticed you haven't connected your MetaTrader to Onyx yet. That's what unlocks your live numbers and **Onyx Guardian** protecting your risk.\n\nIt takes about 2 minutes:\n{{sitio}}/guia/conectar-cuenta\n\nStuck? Just reply to this email and we'll help.`,
  },
  {
    key: 'inactive', name: 'Trader inactivo', kind: 'trigger', segment: 'inactive', trigger: { days: 14, maxDays: 90 },
    subject_es: 'Te echamos de menos, {{nombre}} 📉→📈',
    body_es: `Hola {{nombre}},\n\nHace un tiempo que tu cuenta no envía datos a Onyx. Si volviste a operar, reconecta y sigue viendo tu progreso y tus alertas.\n\nAbre tu panel:\n{{sitio}}/dashboard\n\nSi algo dejó de funcionar, cuéntanos respondiendo aquí.`,
    subject_en: 'We miss you, {{nombre}} 📉→📈',
    body_en: `Hi {{nombre}},\n\nYour account hasn't sent data to Onyx in a while. If you're trading again, reconnect and keep tracking your progress and alerts.\n\nOpen your dashboard:\n{{sitio}}/dashboard\n\nIf something stopped working, tell us by replying here.`,
  },
  {
    key: 'trial_expiring', name: 'Prueba por expirar', kind: 'trigger', segment: 'trial_expiring', trigger: {},
    subject_es: 'Tu prueba de Onyx está por terminar ⏳',
    body_es: `Hola {{nombre}},\n\nTu periodo de prueba está por terminar. Para no perder tus estadísticas en vivo, Onyx Guardian y tus alertas, elige tu plan:\n{{sitio}}/pricing\n\n¿Dudas para decidir? Respóndenos y te orientamos.`,
    subject_en: 'Your Onyx trial is ending soon ⏳',
    body_en: `Hi {{nombre}},\n\nYour trial is about to end. To keep your live stats, Onyx Guardian and your alerts, pick your plan:\n{{sitio}}/pricing\n\nNot sure which one? Reply and we'll guide you.`,
  },
  {
    key: 'newsletter', name: 'Newsletter semanal', kind: 'scheduled', segment: 'all', schedule: '0 9 * * 1', trigger: {},
    subject_es: 'Onyx · novedades de la semana 📰',
    body_es: `Hola {{nombre}},\n\n(Escribe aquí las novedades, tips o promos de la semana.)\n\n— Equipo de Onyx Trading Live`,
    subject_en: 'Onyx · this week 📰',
    body_en: `Hi {{nombre}},\n\n(Write this week's news, tips or promos here.)\n\n— The Onyx Trading Live team`,
  },
];

// Crea las campañas por defecto si aún no existen (por `key`). No pisa las editadas.
export async function ensureDefaultCampaigns() {
  const { data: existing } = await supabaseAdmin.from('campaigns').select('key').not('key', 'is', null);
  const have = new Set((existing || []).map((r: any) => r.key));
  const toAdd = DEFAULT_CAMPAIGNS.filter((c) => c.key && !have.has(c.key));
  if (toAdd.length) await supabaseAdmin.from('campaigns').insert(toAdd as any);
}

// Sustituye variables de plantilla: {{nombre}} {{plan}} {{sitio}}.
export function renderTemplate(text: string, r: Recipient): string {
  return String(text || '')
    .replace(/\{\{\s*(nombre|name)\s*\}\}/gi, r.name || (r.lang === 'en' ? 'there' : ''))
    .replace(/\{\{\s*plan\s*\}\}/gi, r.plan || 'free')
    .replace(/\{\{\s*(sitio|site)\s*\}\}/gi, SITE);
}

// Enlace de baja de un clic. Genera y guarda un token si el usuario no tiene.
async function unsubUrl(r: Recipient): Promise<string> {
  let token = '';
  try {
    const { data } = await supabaseAdmin.from('profiles').select('unsub_token').eq('id', r.id).maybeSingle();
    token = (data as any)?.unsub_token || '';
    if (!token) {
      token = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + Math.random().toString(36).slice(2);
      await supabaseAdmin.from('profiles').update({ unsub_token: token }).eq('id', r.id);
    }
  } catch {}
  return `${SITE}/unsub?u=${encodeURIComponent(token)}`;
}

// Envía UN correo de campaña a un destinatario y lo registra (dedupe/analítica).
async function sendOne(c: { id?: string; key?: string | null; kind: string }, r: Recipient, subject: string, body: string) {
  const unsub = await unsubUrl(r);
  const { ok, id } = await sendEmailId(r.email, renderTemplate(subject, r), renderTemplate(body, r), {
    kind: 'campaign', userId: r.id, unsub, meta: { campaign: c.key || c.id },
  });
  try {
    await supabaseAdmin.from('campaign_sends').insert({
      campaign_id: c.id || null, campaign_key: c.key || null, user_id: r.id, email: r.email,
      status: ok ? 'sent' : 'failed', resend_id: id,
    });
  } catch {
    // Reintento tolerante por si aún no existe la columna resend_id.
    try {
      await supabaseAdmin.from('campaign_sends').insert({
        campaign_id: c.id || null, campaign_key: c.key || null, user_id: r.id, email: r.email, status: ok ? 'sent' : 'failed',
      });
    } catch {}
  }
  return ok;
}

// Los que YA recibieron esta campaña (para no repetir en las 'trigger').
async function alreadySent(campaignKey: string | null, campaignId: string): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    let q = supabaseAdmin.from('campaign_sends').select('user_id');
    q = campaignKey ? q.eq('campaign_key', campaignKey) : q.eq('campaign_id', campaignId);
    const { data } = await q.limit(50000);
    for (const s of (data || []) as any[]) if (s.user_id) set.add(s.user_id);
  } catch {}
  return set;
}

// --- CRON: recorre las campañas automáticas activas y envía lo que toca.
export async function runCampaigns(dryRun = false): Promise<{ sent: number; detail: Array<{ campaign: string; sent: number }> }> {
  await ensureDefaultCampaigns();
  const { data: camps } = await supabaseAdmin
    .from('campaigns').select('*').eq('enabled', true).in('kind', ['trigger', 'scheduled']);

  let budget = PER_RUN;
  let total = 0;
  const detail: Array<{ campaign: string; sent: number }> = [];

  for (const c of (camps || []) as CampaignRow[]) {
    if (budget <= 0) break;

    // Las programadas solo corren cada X días (evita reenviar el boletín a diario).
    if (c.kind === 'scheduled') {
      const since = c.last_run_at ? (Date.now() - new Date(c.last_run_at).getTime()) / 86400000 : Infinity;
      if (since < SCHEDULED_INTERVAL_DAYS) { detail.push({ campaign: c.key || c.name, sent: 0 }); continue; }
    }

    const recips = await resolveSegment(c.segment, c.trigger || {});
    // 'trigger' = una vez por usuario (para siempre). 'scheduled' = una vez por corrida.
    const seen = c.kind === 'trigger' ? await alreadySent(c.key, c.id) : new Set<string>();
    const targets = recips.filter((r) => !seen.has(r.id)).slice(0, budget);

    let sent = 0;
    for (const r of targets) {
      const subject = r.lang === 'en' ? c.subject_en : c.subject_es;
      const body = r.lang === 'en' ? c.body_en : c.body_es;
      if (!subject || !body) continue;
      if (!dryRun) { const ok = await sendOne(c, r, subject, body); if (ok) sent++; }
      else sent++;
    }
    budget -= sent; total += sent;
    if (!dryRun) await supabaseAdmin.from('campaigns').update({ last_run_at: new Date().toISOString() }).eq('id', c.id);
    detail.push({ campaign: c.key || c.name, sent });
  }

  // Promos PROGRAMADAS (manuales con scheduled_at ya vencida). Salen una vez y se
  // limpia scheduled_at para no repetir.
  try {
    const nowIso = new Date().toISOString();
    const { data: due } = await supabaseAdmin
      .from('campaigns').select('*').eq('kind', 'manual').eq('enabled', true)
      .not('scheduled_at', 'is', null).lte('scheduled_at', nowIso);
    for (const c of (due || []) as CampaignRow[]) {
      if (budget <= 0) break;
      const recips = (await resolveSegment(c.segment, {})).slice(0, budget);
      let sent = 0;
      for (const r of recips) {
        const subject = r.lang === 'en' ? (c.subject_en || c.subject_es) : c.subject_es;
        const body = r.lang === 'en' ? (c.body_en || c.body_es) : c.body_es;
        if (!subject || !body) continue;
        if (!dryRun) { const ok = await sendOne({ id: c.id, key: c.key, kind: 'manual' }, r, subject, body); if (ok) sent++; }
        else sent++;
      }
      budget -= sent; total += sent;
      if (!dryRun) await supabaseAdmin.from('campaigns').update({ scheduled_at: null, enabled: false, last_run_at: new Date().toISOString() }).eq('id', c.id);
      detail.push({ campaign: c.name, sent });
    }
  } catch {}

  return { sent: total, detail };
}

// --- MANUAL: envía una promo/noticia AHORA a un segmento. Se puede pasar una
// campaña guardada (campaignId) o texto ad-hoc. `dryRun` solo cuenta.
export async function sendManual(opts: {
  campaignId?: string; segment?: string; subject_es?: string; body_es?: string; subject_en?: string; body_en?: string; dryRun?: boolean;
}): Promise<{ count: number; sent: number }> {
  let seg = opts.segment || 'all';
  let sEs = opts.subject_es || '', bEs = opts.body_es || '', sEn = opts.subject_en || '', bEn = opts.body_en || '';
  let camp: { id?: string; key?: string | null; kind: string } = { kind: 'manual' };

  if (opts.campaignId) {
    const { data } = await supabaseAdmin.from('campaigns').select('*').eq('id', opts.campaignId).maybeSingle();
    if (data) {
      const c = data as CampaignRow;
      seg = c.segment; sEs = c.subject_es; bEs = c.body_es; sEn = c.subject_en; bEn = c.body_en;
      camp = { id: c.id, key: c.key, kind: 'manual' };
    }
  }

  const recips = await resolveSegment(seg, {});
  if (opts.dryRun) return { count: recips.length, sent: 0 };

  let sent = 0;
  for (const r of recips.slice(0, 5000)) {
    const subject = r.lang === 'en' ? (sEn || sEs) : sEs;
    const body = r.lang === 'en' ? (bEn || bEs) : bEs;
    if (!subject || !body) continue;
    const ok = await sendOne(camp, r, subject, body);
    if (ok) sent++;
  }
  return { count: recips.length, sent };
}

export type PerKey = { sent: number; opened: number; clicked: number; failed: number };

// Métricas de los últimos 30 días: totales + desglose por campaña, con
// aperturas y clics reales (los rellena el webhook de Resend).
export async function campaignStats(): Promise<{
  sent30: number; failed30: number; opened30: number; clicked30: number;
  byKey: Record<string, PerKey>;
}> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  let data: any[] = [];
  try {
    const r = await supabaseAdmin.from('campaign_sends')
      .select('status,campaign_key,opened_at,clicked_at,created_at').gte('created_at', since).limit(50000);
    data = (r.data || []) as any[];
  } catch {
    // Sin las columnas de tracking todavía: solo totales de enviados/fallidos.
    const r = await supabaseAdmin.from('campaign_sends').select('status,campaign_key,created_at').gte('created_at', since).limit(50000);
    data = (r.data || []) as any[];
  }

  let sent30 = 0, failed30 = 0, opened30 = 0, clicked30 = 0;
  const byKey: Record<string, PerKey> = {};
  for (const s of data) {
    const k = s.campaign_key || 'manual';
    if (!byKey[k]) byKey[k] = { sent: 0, opened: 0, clicked: 0, failed: 0 };
    const bad = s.status === 'failed' || s.status === 'bounced';
    if (bad) { failed30++; byKey[k].failed++; }
    else { sent30++; byKey[k].sent++; }
    if (s.opened_at) { opened30++; byKey[k].opened++; }
    if (s.clicked_at) { clicked30++; byKey[k].clicked++; }
  }
  return { sent30, failed30, opened30, clicked30, byKey };
}
