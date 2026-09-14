import type { Scorecard } from '@/lib/salesPerf';
import { ruleSuggestion } from '@/lib/salesPerf';

// ============================================================
// IA del plan de manejo de ventas. Convierte la tarjeta de desempeño de un
// representante en una lectura corta y accionable para el supervisor/admin.
// Reusa el mismo cliente HTTP de Anthropic que el resto del panel.
// LÍNEA: la IA RECOMIENDA; las acciones (ascender/pausar) las decide la persona.
// ============================================================

async function anthropic(system: string, user: string, maxTokens = 380): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user.slice(0, 3000) }] }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('ventas', d)).catch(() => {});
    return (d?.content || []).map((c: any) => c.text || '').join('\n').trim() || null;
  } catch { return null; }
}

const TIER_ES = { star: 'Estrella', solid: 'Sólido', risk: 'En riesgo' } as const;

// Devuelve { headline, summary, actions[] }. Si no hay IA, cae a reglas.
export async function perfInsight(
  card: Scorecard,
  who: { name: string; role: string },
  names: { l2: string; l1: string; vendedor: string },
  lang: 'es' | 'en' = 'es',
): Promise<{ headline: string; summary: string; actions: string[]; ai: boolean }> {
  const fallback = ruleSuggestion(card, names, lang);
  const es = lang === 'es';
  const facts = [
    `${es ? 'Nombre' : 'Name'}: ${who.name} (${who.role})`,
    `${es ? 'Puntaje' : 'Score'}: ${card.score}/100 · Tier: ${TIER_ES[card.tier]}`,
    `${es ? 'Clientes' : 'Clients'}: ${card.clients} (${card.active} ${es ? 'activos' : 'active'}, ${card.new30} ${es ? 'nuevos 30d' : 'new 30d'}, ${card.churned} ${es ? 'perdidos' : 'churned'})`,
    `${es ? 'Reseñas' : 'Reviews'}: ${card.rating || '—'}/5 (${card.reviews})`,
    `${es ? 'Conversión de pruebas' : 'Trial conversion'}: ${card.trial_conv}% · ${es ? 'pruebas' : 'trials'} ${card.trials} · ${es ? 'descuentos' : 'discounts'} ${card.discounts}`,
    `${es ? 'Atención' : 'Support'}: ${card.tickets_open} ${es ? 'abiertos' : 'open'}, ${es ? 'respuesta' : 'response'} ${card.resp_hrs == null ? '—' : card.resp_hrs + 'h'}`,
    `${es ? 'Comisión' : 'Commission'}: $${card.earned} ${es ? 'total' : 'total'} ($${card.earned30} 30d)`,
    `${es ? 'Sub-puntajes' : 'Sub-scores'}: reseñas ${card.parts.rating}, conversión ${card.parts.conversion}, actividad ${card.parts.activity}, atención ${card.parts.service}, retención ${card.parts.retention}`,
  ].join('\n');

  const system = es
    ? 'Eres el gerente de ventas de Onyx Trading Live. Lee la tarjeta de desempeño de un representante y responde SOLO con JSON: {"headline": "5-8 palabras con el veredicto", "summary": "2-3 frases claras y honestas, sin relleno", "actions": ["accion 1","accion 2","accion 3"]}. Las acciones son recomendaciones concretas para el supervisor; NO ejecutes nada, solo sugiere. Español neutro.'
    : 'You are the sales manager at Onyx Trading Live. Read a rep performance card and reply ONLY with JSON: {"headline":"5-8 word verdict","summary":"2-3 clear honest sentences, no fluff","actions":["action 1","action 2","action 3"]}. Actions are concrete recommendations for the supervisor; do NOT execute anything, only suggest.';

  const raw = await anthropic(system, facts);
  if (raw) {
    try {
      const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
      const actions = Array.isArray(j.actions) ? j.actions.map((a: any) => String(a)).slice(0, 4) : fallback.actions;
      return { headline: String(j.headline || fallback.headline), summary: String(j.summary || ''), actions, ai: true };
    } catch {}
  }
  return { headline: fallback.headline, summary: '', actions: fallback.actions, ai: false };
}
