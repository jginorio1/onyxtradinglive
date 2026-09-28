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

// Meta (título + descripción) optimizado para UNA página, en ES e INGLÉS a la vez,
// congruente con las KEYWORDS prioritarias que el dueño ya trabaja (SEO del blog).
const PAGE_DESC: Record<string, string> = {
  home: 'la página de inicio / landing principal de la plataforma',
  pricing: 'la página de planes y precios (Gratis, Pro, Elite)',
  guia: 'la guía/centro de ayuda con artículos de instalación, métricas y reglas de prop firms',
  blog: 'la portada del blog (artículos de trading, disciplina, prop firms)',
  embajadores: 'la página del programa de embajadores/afiliados (comisión recurrente)',
  contacto: 'la página de contacto y soporte',
};
export async function pageMeta(page: string, keywordsEs: string[] = [], keywordsEn: string[] = []): Promise<{ ok: boolean; meta?: { title_es: string; title_en: string; desc_es: string; desc_en: string }; reason?: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, reason: 'no_key' };
  const what = PAGE_DESC[page] || `la página "${page}"`;
  const kwEs = keywordsEs.slice(0, 8).join(', ');
  const kwEn = keywordsEn.slice(0, 8).join(', ');
  const system = `Eres especialista SEO de Onyx Trading Live (diario de trading + Onyx Guardian, copy trading, academia; MT4/MT5/cTrader). Escribe el TÍTULO y la META DESCRIPCIÓN para ${what}, en ESPAÑOL e INGLÉS. Optimizado para clic en Google. NUNCA prometas ganancias ni predigas el mercado.

Reglas de longitud ESTRICTAS (cuéntalas): el título NO debe pasar de 60 caracteres (apunta a 52-58 para dejar margen); la descripción NO debe pasar de 155 caracteres (apunta a 145-152). Si dudas, quédate CORTO. Incluye la marca "Onyx Trading Live" en el título cuando quepa.
CONGRUENCIA: integra de forma NATURAL las keywords prioritarias (sin forzar ni repetir). Español: ${kwEs || '(usa términos del nicho)'}. English: ${kwEn || '(use niche terms)'}.

Devuelve SOLO JSON válido, sin texto extra:
{"title_es":"...","title_en":"...","desc_es":"...","desc_en":"..."}

=== CONOCIMIENTO DE ONYX ===
${await brandBrief('es')}`;
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 600, system, messages: [{ role: 'user', content: `Meta para: ${what}.` }] }),
    });
    if (!r.ok) return { ok: false, reason: 'error' };
    const d = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('seo', d)).catch(() => {});
    const parsed = parseJson((d?.content || []).map((c: any) => c.text || '').join('\n').trim());
    if (!parsed) return { ok: false, reason: 'parse' };
    const meta = {
      title_es: String(parsed.title_es || '').slice(0, 70), title_en: String(parsed.title_en || '').slice(0, 70),
      desc_es: String(parsed.desc_es || '').slice(0, 170), desc_en: String(parsed.desc_en || '').slice(0, 170),
    };
    if (!meta.title_es && !meta.title_en) return { ok: false, reason: 'empty' };
    return { ok: true, meta };
  } catch { return { ok: false, reason: 'error' }; }
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
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 1400, system, messages: [{ role: 'user', content: user.slice(0, 800) }] }),
    });
    if (!r.ok) return { ok: false, reason: 'error' };
    const d = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('seo', d)).catch(() => {});
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
