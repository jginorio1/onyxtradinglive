import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Redes sociales: metadatos, constructor de enlace "compartir" y programación
// (modo recordatorio). El copy lo genera blogAI.socialCopy por red e idioma.
// ============================================================

export type Network = 'x' | 'linkedin' | 'facebook' | 'telegram' | 'whatsapp' | 'instagram' | 'tiktok' | 'reddit' | 'threads';

export const NETWORKS: Array<{ id: Network; label: string; color: string; icon: string; canShareLink: boolean; note?: string }> = [
  { id: 'x', label: 'X / Twitter', color: '#1d9bf0', icon: '𝕏', canShareLink: true },
  { id: 'linkedin', label: 'LinkedIn', color: '#0a66c2', icon: 'in', canShareLink: true, note: 'LinkedIn solo pasa el enlace; pega el copy al publicar.' },
  { id: 'facebook', label: 'Facebook', color: '#1877f2', icon: 'f', canShareLink: true, note: 'Facebook solo pasa el enlace; pega el copy al publicar.' },
  { id: 'telegram', label: 'Telegram', color: '#26a5e4', icon: '✈', canShareLink: true },
  { id: 'whatsapp', label: 'WhatsApp', color: '#25d366', icon: '✆', canShareLink: true },
  { id: 'reddit', label: 'Reddit', color: '#ff4500', icon: 'r', canShareLink: true },
  { id: 'instagram', label: 'Instagram', color: '#bc1888', icon: '◎', canShareLink: false, note: 'No permite compartir enlace: copia el caption y pega (enlace en bio).' },
  { id: 'tiktok', label: 'TikTok', color: '#000000', icon: '♪', canShareLink: false, note: 'No permite compartir enlace: copia el caption.' },
  { id: 'threads', label: 'Threads', color: '#000000', icon: '@', canShareLink: false, note: 'Copia el texto para pegar.' },
];
export const NETWORK_LABEL: Record<string, string> = Object.fromEntries(NETWORKS.map((n) => [n.id, n.label]));

// Enlace "compartir" que abre la red con el texto y/o el enlace ya puestos.
// Devuelve null si la red no admite compartir por enlace (solo copiar caption).
export function shareUrl(network: Network, url: string, text: string): string | null {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  const tu = encodeURIComponent(`${text}\n\n${url}`);
  switch (network) {
    case 'x': return `https://twitter.com/intent/tweet?text=${t}&url=${u}`;
    case 'linkedin': return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case 'facebook': return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case 'telegram': return `https://t.me/share/url?url=${u}&text=${t}`;
    case 'whatsapp': return `https://wa.me/?text=${tu}`;
    case 'reddit': return `https://www.reddit.com/submit?url=${u}&title=${t}`;
    default: return null;   // instagram, tiktok, threads → solo copiar
  }
}

// URL pública del artículo según idioma (EN vive bajo /en).
export function articleUrl(site: string, slug: string, lang: string): string {
  const base = site.replace(/\/$/, '');
  return lang === 'en' ? `${base}/en/blog/${slug}` : `${base}/blog/${slug}`;
}

// ---- Programación (recordatorio) ----
export async function scheduleSocial(rows: Array<{ blog_post_id: string; slug: string; network: string; lang: string; copy: string; url: string; scheduled_at: string }>) {
  const clean = rows
    .filter((r) => r.copy && r.scheduled_at && r.network)
    .map((r) => ({ ...r, copy: String(r.copy).slice(0, 4000), status: 'pending' }));
  if (!clean.length) return { inserted: 0 };
  const { error } = await supabaseAdmin.from('social_posts').insert(clean);
  if (error) throw new Error(error.message);
  return { inserted: clean.length };
}

export async function listSocial(blogPostId?: string) {
  let q = supabaseAdmin.from('social_posts').select('*').order('scheduled_at', { ascending: true }).limit(300);
  if (blogPostId) q = q.eq('blog_post_id', blogPostId);
  const { data } = await q;
  return (data || []) as any[];
}

export async function cancelSocial(id: string) {
  await supabaseAdmin.from('social_posts').update({ status: 'canceled' }).eq('id', id);
}

// Publicaciones vencidas y aún pendientes (para el cron y para el badge del panel).
export async function dueSocial() {
  const { data } = await supabaseAdmin.from('social_posts')
    .select('*').eq('status', 'pending').lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true }).limit(100);
  return (data || []) as any[];
}
export async function markSocialSent(id: string) {
  await supabaseAdmin.from('social_posts').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id);
}
