import { ONYX_BRIEF, brandBrief } from '@/lib/supportAI';

// ============================================================
// AI para embajadores. Dos usos:
//  · draftInvite: invitación personalizada a un creador (correo).
//  · draftPost: publicación lista para una plataforma, con el enlace + cupón
//    del embajador ya insertados.
// Reusa el "cerebro" de Onyx (ONYX_BRIEF) para no inventar funciones. Bilingüe.
// ============================================================

import type { Lang } from './navText';
import { aiLangDirective, enBase, LANG_NAME } from '@/lib/i18n';

async function anthropic(system: string, user: string, maxTokens = 900): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user.slice(0, 1500) }] }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return (data?.content || []).map((c: any) => c.text || '').join('\n').trim() || null;
  } catch { return null; }
}

const NICHE_ES: Record<string, string> = { prop: 'cuentas de fondeo / prop firms', beginners: 'traders principiantes', signals: 'señales', forex: 'forex', crypto: 'cripto', other: 'trading' };
const NICHE_EN: Record<string, string> = { prop: 'prop-firm / funded accounts', beginners: 'beginner traders', signals: 'signals', forex: 'forex', crypto: 'crypto', other: 'trading' };

// Invitación a un creador (correo). Devuelve { subject, body } editable.
export async function draftInvite(opts: { name: string; platform: string; niche: string; lang: Lang; rate: number; couponPct: number }):
  Promise<{ ok: boolean; subject?: string; body?: string; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const nicheLabel = (enBase(opts.lang) ? NICHE_EN : NICHE_ES)[opts.niche] || opts.niche;
  const system = (enBase(opts.lang)
    ? `You write short, warm, personal partnership-invitation emails from Onyx Trading Live to content creators. Honest, not salesy. Use the ONYX KNOWLEDGE below as the only source of truth about the product — never invent features and never promise profits or income. Lead with the value for THEIR audience (especially the prop-firm angle: Onyx Guardian enforces challenge rules). Mention the offer: ${opts.rate}% recurring commission for them and a ${opts.couponPct}% discount coupon for their followers. End with a soft call to reply. Max ~130 words.`
    : `Escribes correos de invitación de colaboración cortos, cercanos y personales, de Onyx Trading Live para creadores de contenido. Honesto, sin sonar a venta. Usa el CONOCIMIENTO DE ONYX de abajo como única fuente de verdad — nunca inventes funciones ni prometas ganancias. Empieza por el valor para SU audiencia (sobre todo el ángulo de prop firms: Onyx Guardian hace respetar las reglas del reto). Menciona la oferta: ${opts.rate}% de comisión recurrente para él/ella y un cupón de ${opts.couponPct}% de descuento para sus seguidores. Cierra con una llamada suave a responder. Máx ~130 palabras.`)
    + `\n\nDevuelve SOLO un JSON válido: {"subject":"...","body":"..."}`
    + `\n\n=== ${enBase(opts.lang) ? 'ONYX KNOWLEDGE' : 'CONOCIMIENTO DE ONYX'} ===\n${await brandBrief(opts.lang)}` + aiLangDirective(opts.lang);
  const user = enBase(opts.lang)
    ? `Creator: ${opts.name}. Platform: ${opts.platform}. Audience/niche: ${nicheLabel}.`
    : `Creador: ${opts.name}. Plataforma: ${opts.platform}. Audiencia/nicho: ${nicheLabel}.`;

  const raw = await anthropic(system, user, 700);
  if (!raw) return { ok: false, reason: 'error' };
  try {
    const j = JSON.parse(raw.replace(/```json/gi, '').replace(/```/g, '').trim());
    if (!j.subject && !j.body) return { ok: false, reason: 'empty' };
    return { ok: true, subject: String(j.subject || '').slice(0, 180), body: String(j.body || '').slice(0, 2500) };
  } catch { return { ok: false, reason: 'parse' }; }
}

// Publicación para una plataforma, con enlace + cupón ya puestos. Texto plano.
export async function draftPost(opts: { platform: string; link: string; code: string; couponPct: number; niche: string; lang: Lang }):
  Promise<{ ok: boolean; text?: string; reason?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const nicheLabel = (enBase(opts.lang) ? NICHE_EN : NICHE_ES)[opts.niche] || opts.niche;
  const fmt: Record<string, string> = enBase(opts.lang)
    ? { youtube: 'a YouTube video description / pinned comment', instagram: 'a short Instagram caption', tiktok: 'a punchy TikTok caption', telegram: 'a Telegram/WhatsApp broadcast message', x: 'a short tweet' }
    : { youtube: 'una descripción de video de YouTube / comentario fijado', instagram: 'un pie de foto corto de Instagram', tiktok: 'un pie de TikTok con gancho', telegram: 'un mensaje de difusión de Telegram/WhatsApp', x: 'un tuit corto' };
  const format = fmt[opts.platform] || fmt.instagram;

  const system = (enBase(opts.lang)
    ? `You are a social copywriter for creators promoting Onyx Trading Live. Write ${format} that the creator can post as-is. Honest, engaging, with 1-2 tasteful emojis. NEVER promise profits/income and never invent features — use only the ONYX KNOWLEDGE below. Lean into the ${nicheLabel} angle. You MUST include this exact link and code at the end: link ${opts.link} and code ${opts.code} (${opts.couponPct}% off). Output ONLY the post text, nothing else.`
    : `Eres un copywriter social para creadores que promocionan Onyx Trading Live. Escribe ${format} que el creador pueda publicar tal cual. Honesto, con gancho, con 1-2 emojis con criterio. NUNCA prometas ganancias ni inventes funciones — usa solo el CONOCIMIENTO DE ONYX de abajo. Apóyate en el ángulo de ${nicheLabel}. DEBES incluir al final este enlace y código exactos: enlace ${opts.link} y código ${opts.code} (${opts.couponPct}% de descuento). Devuelve SOLO el texto del post, nada más.`)
    + `\n\n=== ${enBase(opts.lang) ? 'ONYX KNOWLEDGE' : 'CONOCIMIENTO DE ONYX'} ===\n${await brandBrief(opts.lang)}` + aiLangDirective(opts.lang);
  const user = enBase(opts.lang) ? `Write the post for ${opts.platform}.` : `Escribe el post para ${opts.platform}.`;

  const raw = await anthropic(system, user, 500);
  if (!raw) return { ok: false, reason: 'error' };
  return { ok: true, text: raw.slice(0, 1200) };
}
