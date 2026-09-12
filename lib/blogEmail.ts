import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendManual } from '@/lib/campaigns';
import { slugFor } from '@/lib/blog';
import { articleUrl } from '@/lib/social';
import { logError } from '@/lib/errlog';

// ============================================================
// Envío de un artículo del blog por email a la base de datos (segmento de
// traders que aceptan marketing). Reusa el motor de campañas (sendManual), que
// respeta el opt-out y registra cada envío. El contenido se arma desde el propio
// artículo (título + extracto + enlace), bilingüe según el idioma del suscriptor.
// ============================================================

const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

// Construye el correo (asunto + cuerpo) en ES e EN a partir del artículo.
export function buildBlogEmail(post: any): { subject_es: string; body_es: string; subject_en: string; body_en: string } {
  const tEs = String(post.title_es || post.title_en || '').trim();
  const tEn = String(post.title_en || post.title_es || '').trim();
  const xEs = String(post.excerpt_es || post.excerpt_en || '').trim();
  const xEn = String(post.excerpt_en || post.excerpt_es || '').trim();
  const urlEs = articleUrl(SITE, slugFor(post, 'es'), 'es');
  const urlEn = articleUrl(SITE, slugFor(post, 'en'), 'en');
  const body_es = `Hola {{nombre}},\n\n**${tEs}**\n\n${xEs}\n\nLéelo completo aquí:\n${urlEs}\n\n— Equipo de Onyx Trading Live`;
  const body_en = `Hi {{nombre}},\n\n**${tEn}**\n\n${xEn}\n\nRead the full article here:\n${urlEn}\n\n— The Onyx Trading Live team`;
  return {
    subject_es: `📰 ${tEs}`.slice(0, 120),
    subject_en: `📰 ${tEn}`.slice(0, 120),
    body_es, body_en,
  };
}

// Marca en el post que el correo ya salió (tolerante si la columna no existe).
async function markSent(id: string) {
  try { await supabaseAdmin.from('blog_posts').update({ email_sent_at: new Date().toISOString() }).eq('id', id); } catch {}
}

// Envía AHORA el artículo al segmento indicado. Idempotente: si ya se envió
// (email_sent_at) no repite, salvo force.
export async function sendBlogEmailNow(post: any, segment = 'all', force = false): Promise<{ count: number; sent: number } | null> {
  if (!post) return null;
  if (post.email_sent_at && !force) return null;
  // Necesita contenido y al menos un título.
  if (!(post.body_es || post.body_en) || !(post.title_es || post.title_en)) return null;
  const mail = buildBlogEmail(post);
  try {
    const res = await sendManual({ segment: segment || 'all', ...mail });
    await markSent(post.id);
    return res;
  } catch (e) { await logError('blog_email_send', e); return null; }
}

// Cron: envía los artículos con email pendiente cuya condición ya se cumple.
//  · when 'publish'  → cuando el post está publicado.
//  · when 'schedule' → cuando llega email_at (independiente de la publicación).
//  · when 'now'      → normalmente ya salió al guardar; si quedó pendiente, sale.
export async function sendDueBlogEmails(): Promise<number> {
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
