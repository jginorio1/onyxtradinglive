import { brandBrief } from '@/lib/supportAI';
import type { Lang } from '@/lib/navText';

// ============================================================
// IA para Onyx Bot Lab: redacta un correo/promo para la audiencia de leads del
// marketplace de robots (creadores/compradores). Honesto, sin promesas de
// rentabilidad. Devuelve asunto + cuerpo en el idioma pedido.
// ============================================================
function parseJson(txt: string | null): any | null {
  if (!txt) return null;
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

export async function draftBotLabPromo(opts: { topic: string; lang: Lang }): Promise<{ ok: boolean; subject?: string; body?: string; reason?: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, reason: 'no_key' };
  const es = opts.lang !== 'en';
  const system = `Eres el redactor de Onyx Bot Lab (marketplace de robots/EAs para MT4/MT5/cTrader, servicios de creación de bots y VPS). Escribe un correo de promo/novedad CORTO (máx ~120 palabras), cercano y honesto para la audiencia de leads. NUNCA prometas rentabilidad ni inventes funciones. Usa {nombre} donde salude. Incluye una CTA suave. Escribe en ${es ? 'ESPAÑOL' : 'INGLÉS'}.

Devuelve SOLO JSON válido: {"subject":"...","body":"..."}

=== CONOCIMIENTO DE ONYX ===
${await brandBrief(opts.lang)}`;
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 700, system, messages: [{ role: 'user', content: `Tema/instrucción: ${String(opts.topic || '').slice(0, 600)}` }] }),
    });
    if (!r.ok) return { ok: false, reason: 'error' };
    const d = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('botlab', d)).catch(() => {});
    const j = parseJson((d?.content || []).map((c: any) => c.text || '').join('\n').trim());
    if (!j || (!j.subject && !j.body)) return { ok: false, reason: 'parse' };
    return { ok: true, subject: String(j.subject || '').slice(0, 160), body: String(j.body || '').slice(0, 4000) };
  } catch { return { ok: false, reason: 'error' }; }
}
