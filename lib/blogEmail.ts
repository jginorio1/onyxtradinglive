import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendManual } from '@/lib/campaigns';
import { slugFor } from '@/lib/blog';
import { articleUrl } from '@/lib/social';
import { logError } from '@/lib/errlog';
import { blogAutopilotSettings, getSetting, saveSetting, newsPilotSettings } from '@/lib/settings';

// Interruptor GLOBAL de correos del blog. Un solo lugar de control: si el dueño
// apaga "autoEmail" en el autopiloto del blog, NO sale ningún correo de artículos
// (ni de los generados por el piloto ni de los manuales). Así se evita el "me
// llegan 5 artículos por email" sin tener que apagar cada post uno por uno.
async function blogEmailGloballyOn(): Promise<boolean> {
  try { const s = await blogAutopilotSettings(); return s?.autoEmail !== false; } catch { return true; }
}

// ============================================================
// Envío de un artículo del blog por email a la base de datos (segmento de
// traders que aceptan marketing). Reusa el motor de campañas (sendManual), que
// respeta el opt-out y registra cada envío. El contenido se arma desde el propio
// artículo (título + extracto + enlace), bilingüe según el idioma del suscriptor.
// ============================================================

const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

// Construye el correo del artículo BILINGÜE: cada suscriptor lo recibe en el
// idioma de su perfil (igual que las campañas). El motor (sendManual/renderTemplate)
// elige el texto _es o _en según el idioma del destinatario. Si falta un idioma en
// el artículo, se cae con gracia al otro para no mandar vacío.
export function buildBlogEmail(post: any): { subject_es: string; body_es: string; subject_en: string; body_en: string } {
  // Español
  const tEs = String(post.title_es || post.title_en || '').trim();
  const xEs = String(post.excerpt_es || post.excerpt_en || '').trim();
  const urlEs = articleUrl(SITE, slugFor(post, 'es'), 'es');
  const subject_es = `📰 ${tEs}`.slice(0, 120);
  const body_es = `Hola {{nombre}},\n\n**${tEs}**\n\n${xEs}\n\nLee el artículo completo aquí:\n${urlEs}\n\n— Equipo de Onyx Trading Live`;
  // Inglés
  const tEn = String(post.title_en || post.title_es || '').trim();
  const xEn = String(post.excerpt_en || post.excerpt_es || '').trim();
  const urlEn = articleUrl(SITE, slugFor(post, 'en'), 'en');
  const subject_en = `📰 ${tEn}`.slice(0, 120);
  const body_en = `Hi {{nombre}},\n\n**${tEn}**\n\n${xEn}\n\nRead the full article here:\n${urlEn}\n\n— The Onyx Trading Live team`;
  return { subject_es, body_es, subject_en, body_en };
}

// ============================================================
// RESUMEN DIARIO de noticias: en vez de un email por cada nota, junta las noticias
// del día en UN solo correo y lo manda a la hora elegida (≈1-2 h antes de la
// apertura de Nueva York). Así el dueño sigue presente sin saturar la bandeja.
// ============================================================
// Fecha "hoy" en Nueva York (YYYY-MM-DD) para agrupar el día y evitar duplicar.
function nyDateStr(d = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const y = p.find((x) => x.type === 'year')!.value, m = p.find((x) => x.type === 'month')!.value, dd = p.find((x) => x.type === 'day')!.value;
  return `${y}-${m}-${dd}`;
}
// Hora local de Nueva York (0-23), para que el cron dispare a la hora correcta
// aunque cambie el horario de verano (el cron de Vercel corre en UTC).
export function nyHour(d = new Date()): number {
  return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }).format(d), 10) % 24;
}

// Envía el RESUMEN del día. force ignora el candado de "ya enviado hoy" (para test).
export async function sendNewsDigest(force = false): Promise<{ ok: boolean; reason?: string; count?: number }> {
  if (!(await blogEmailGloballyOn())) return { ok: false, reason: 'blog_email_off' };
  const cfg = await newsPilotSettings();
  if ((cfg as any).emailMode !== 'digest' && !force) return { ok: false, reason: 'not_digest_mode' };
  const today = nyDateStr();
  const gate = await getSetting<{ date: string }>('news_digest_last', { date: '' });
  if (gate.date === today && !force) return { ok: false, reason: 'already_sent' };

  // Noticias PUBLICADAS hoy (ventana de Nueva York). Solo is_news.
  const dayStartUtc = new Date(`${today}T00:00:00-04:00`);   // aprox borde de NY (DST-tolerante para el filtro)
  const { data: posts } = await supabaseAdmin.from('blog_posts')
    .select('title_es,title_en,excerpt_es,excerpt_en,slug,slug_en,cat,status,published_at,is_news')
    .eq('status', 'published').eq('is_news', true)
    .gte('published_at', new Date(dayStartUtc.getTime() - 3600000).toISOString())
    .order('published_at', { ascending: true }).limit(20);
  const items = (posts || []).filter((p: any) => nyDateStr(new Date(p.published_at)) === today);
  if (!items.length) { try { await saveSetting('news_digest_last', { date: today }); } catch {} return { ok: true, reason: 'no_news', count: 0 }; }

  const dateEs = new Date().toLocaleDateString('es', { timeZone: 'America/New_York', weekday: 'long', day: 'numeric', month: 'long' });
  const dateEn = new Date().toLocaleDateString('en', { timeZone: 'America/New_York', weekday: 'long', day: 'numeric', month: 'long' });
  const subject_es = `📊 Resumen del día · ${items.length} noticia${items.length > 1 ? 's' : ''} de mercado`.slice(0, 120);
  const subject_en = `📊 Market brief · ${items.length} update${items.length > 1 ? 's' : ''} today`.slice(0, 120);
  const lineEs = (p: any) => `**${String(p.title_es || p.title_en || '').trim()}**\n${String(p.excerpt_es || p.excerpt_en || '').trim()}\n${articleUrl(SITE, slugFor(p, 'es'), 'es')}`;
  const lineEn = (p: any) => `**${String(p.title_en || p.title_es || '').trim()}**\n${String(p.excerpt_en || p.excerpt_es || '').trim()}\n${articleUrl(SITE, slugFor(p, 'en'), 'en')}`;
  const body_es = `Hola {{nombre}},\n\nLo que movió el mercado hoy (${dateEs}):\n\n${items.map(lineEs).join('\n\n')}\n\nAbre tu panel: ${SITE}/dashboard\n\n— Equipo de Onyx Trading Live`;
  const body_en = `Hi {{nombre}},\n\nWhat moved the market today (${dateEn}):\n\n${items.map(lineEn).join('\n\n')}\n\nOpen your dashboard: ${SITE}/dashboard\n\n— The Onyx Trading Live team`;

  try {
    await sendManual({ segment: cfg.emailSegment || 'all', respectCap: true, subject_es, body_es, subject_en, body_en });
    await saveSetting('news_digest_last', { date: today });
    return { ok: true, count: items.length };
  } catch (e) { await logError('news_digest_send', e); return { ok: false, reason: 'send_failed' }; }
}

// Marca en el post que el correo ya salió (tolerante si la columna no existe).
async function markSent(id: string) {
  try { await supabaseAdmin.from('blog_posts').update({ email_sent_at: new Date().toISOString() }).eq('id', id); } catch {}
}

// Envía AHORA el artículo al segmento indicado. Idempotente: si ya se envió
// (email_sent_at) no repite, salvo force.
export async function sendBlogEmailNow(post: any, segment = 'all', force = false): Promise<{ count: number; sent: number } | null> {
  if (!post) return null;
  if (!(await blogEmailGloballyOn())) return null;   // interruptor global apagado → no enviar
  if (post.email_sent_at && !force) return null;
  // Necesita contenido y al menos un título.
  if (!(post.body_es || post.body_en) || !(post.title_es || post.title_en)) return null;
  const mail = buildBlogEmail(post);
  try {
    const res = await sendManual({ segment: segment || 'all', respectCap: true, ...mail });
    await markSent(post.id);
    return res;
  } catch (e) { await logError('blog_email_send', e); return null; }
}

// Cron: envía los artículos con email pendiente cuya condición ya se cumple.
//  · when 'publish'  → cuando el post está publicado.
//  · when 'schedule' → cuando llega email_at (independiente de la publicación).
//  · when 'now'      → normalmente ya salió al guardar; si quedó pendiente, sale.
export async function sendDueBlogEmails(): Promise<number> {
  if (!(await blogEmailGloballyOn())) return 0;   // interruptor global apagado → no enviar nada
  const nowIso = new Date().toISOString();
  let rows: any[] = [];
  try {
    const r = await supabaseAdmin.from('blog_posts').select('*')
      .eq('email_enabled', true).is('email_sent_at', null).limit(50);
    rows = r.data || [];
  } catch { return 0; }   // columnas aún no creadas → nada que hacer
  let sent = 0;
  for (const p of rows) {
    const when = String(p.email_when || 'publish');
    const hasBody = String(p.body_es || '').trim() || String(p.body_en || '').trim();
    if (!hasBody) continue;
    let due = false;
    if (when === 'schedule') due = !!p.email_at && new Date(p.email_at).getTime() <= Date.now();
    else if (when === 'now') due = true;
    else due = p.status === 'published';   // 'publish'
    if (!due) continue;
    const res = await sendBlogEmailNow(p, p.email_segment || 'all');
    if (res) sent++;
  }
  return sent;
}
