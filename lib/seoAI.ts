import { brandBrief } from '@/lib/supportAI';

// ============================================================
// Keyword research con IA. A partir de un tema, propone palabras clave de
// intención, títulos SEO y temas de artículo para el blog de Onyx. Usa el
// cerebro de la marca para no inventar funciones. NO predice el mercado.
// ============================================================

export type KeywordIdea = { keyword: string; intent: string; title: string };
export type SeoIdeas = { keywords: KeywordIdea[]; clusters: string[] };

function parseJson(txt: string | null): any | null {
  if (!txt) return null;
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

export async function keywordIdeas(topic: string, lang: 'es' | 'en'): Promise<{ ok: boolean; ideas?: SeoIdeas; reason?: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, reason: 'no_key' };
  const L = lang === 'es';
  const system = `Eres un especialista SEO de Onyx Trading Live (diario de trading + gestor de riesgo Onyx Guardian, copy trading, academia; MT4/MT5, cTrader). Propón palabras clave REALISTAS de intención de búsqueda (informacional, comercial, transaccional) que un trader escribiría en Google, y para cada una un TÍTULO de artículo optimizado. NUNCA prometas ganancias ni predigas el mercado. Escribe en ${L ? 'español' : 'inglés'}.

Devuelve SOLO un objeto JSON válido, sin texto extra:
{"keywords":[{"keyword":"...","intent":"informacional|comercial|transaccional","title":"..."}, ...],"clusters":["tema 1","tema 2", ...]}
Da 10 keywords y 4 clusters (grupos temáticos para pilar de contenido).

=== CONOCIMIENTO DE ONYX ===
${await brandBrief(lang)}`;
  const user = `Tema: "${topic}". Devuelve keywords de intención + títulos y clusters.`;
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 1400, system, messages: [{ role: 'user', content: user.slice(0, 800) }] }),
    });
    if (!r.ok) return { ok: false, reason: 'error' };
    const d = await r.json();
    const raw = (d?.content || []).map((c: any) => c.text || '').join('\n').trim();
    const parsed = parseJson(raw);
    if (!parsed || !Array.isArray(parsed.keywords)) return { ok: false, reason: 'parse' };
    const ideas: SeoIdeas = {
      keywords: parsed.keywords.slice(0, 14).map((k: any) => ({ keyword: String(k.keyword || '').slice(0, 120), intent: String(k.intent || '').slice(0, 20), title: String(k.title || '').slice(0, 160) })).filter((k: KeywordIdea) => k.keyword),
      clusters: (Array.isArray(parsed.clusters) ? parsed.clusters : []).slice(0, 6).map((c: any) => String(c).slice(0, 80)).filter(Boolean),
    };
    if (!ideas.keywords.length) return { ok: false, reason: 'empty' };
    return { ok: true, ideas };
  } catch { return { ok: false, reason: 'error' }; }
}
