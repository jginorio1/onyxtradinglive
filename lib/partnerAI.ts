// ============================================================
// Autocompletar de socios del directorio CPA (brokers / prop firms / herramientas).
// A partir del NOMBRE del socio (ej. "Axi", "The5ers", "TradingView"), la IA
// sugiere: categoría, descripción ES/EN y reguladores conocidos. Devuelve texto
// EDITABLE — no guarda nada. Nunca inventa el pago CPA (ese es tu trato privado
// de afiliado) ni reguladores de los que no esté segura.
// ============================================================

export type PartnerFill = {
  category: 'broker' | 'propfirm' | 'tool';
  blurb_es: string;
  blurb_en: string;
  regulated: string;
  confident: boolean; // false = la IA no reconoció bien el nombre (revísalo con cuidado)
};

function stripFences(s: string) { return s.replace(/```json/gi, '').replace(/```/g, '').trim(); }

async function callAI(system: string, user: string, maxTokens = 700): Promise<any | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const model = process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user.slice(0, 1500) }] }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    import('@/lib/aiCost').then((m) => m.logAiUsage('socios', data)).catch(() => {});
    const raw = (data?.content || []).map((c: any) => c.text || '').join('\n').trim();
    try { return JSON.parse(stripFences(raw)); } catch { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch {} } return null; }
  } catch { return null; }
}

const CATS = new Set(['broker', 'propfirm', 'tool']);

export async function describePartner(opts: { name: string; category?: string }): Promise<{ ok: boolean; fill?: PartnerFill; reason?: string }> {
  const name = (opts.name || '').trim();
  if (!name) return { ok: false, reason: 'no_name' };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };

  const system = `Eres el editor del directorio de socios de Onyx Trading Live, una plataforma para traders de forex y prop firms. Te doy el NOMBRE de una empresa (un broker de forex, una prop firm, o una herramienta de trading) y debes rellenar su ficha para un directorio de afiliados.

REGLAS ESTRICTAS:
- Escribe SOLO sobre la empresa que reconozcas por ese nombre. Si NO estás razonablemente seguro de qué empresa es, pon "confident": false y deja "regulated" vacío; describe de forma genérica y neutra sin inventar datos.
- "regulated": lista SOLO los reguladores que conozcas con seguridad (ej. "FCA, ASIC, DFSA"). Si no estás seguro, déjalo como "". NUNCA inventes licencias.
- NO menciones cifras de pago, comisiones ni rentabilidad. NO des consejo financiero. NO prometas ganancias.
- Descripciones: 1 frase, atractiva pero sobria, orientada a traders. Máximo ~22 palabras. Sin comillas internas.
- "category": elige "broker" (bróker de forex/CFDs), "propfirm" (firma de fondeo/challenges) o "tool" (herramienta, VPS, señales, etc.).

Devuelve SOLO un objeto JSON válido, sin texto extra:
{"category":"broker|propfirm|tool","blurb_es":"...","blurb_en":"...","regulated":"...","confident":true|false}`;

  const hint = opts.category && CATS.has(opts.category) ? `\nPista de categoría que puso el usuario: "${opts.category}" (respétala si encaja).` : '';
  const user = `Empresa: "${name}".${hint}\nRellena su ficha para el directorio de socios. Da la descripción en español (blurb_es) y su versión natural en inglés (blurb_en).`;

  const parsed = await callAI(system, user, 600);
  if (!parsed) return { ok: false, reason: 'parse' };

  let category = String(parsed.category || opts.category || 'broker').toLowerCase();
  if (!CATS.has(category)) category = 'broker';

  const fill: PartnerFill = {
    category: category as PartnerFill['category'],
    blurb_es: String(parsed.blurb_es || '').replace(/["\n]/g, ' ').trim().slice(0, 180),
    blurb_en: String(parsed.blurb_en || '').replace(/["\n]/g, ' ').trim().slice(0, 180),
    regulated: String(parsed.regulated || '').replace(/["\n]/g, ' ').trim().slice(0, 120),
    confident: parsed.confident !== false,
  };
  if (!fill.blurb_es && !fill.blurb_en) return { ok: false, reason: 'empty' };
  return { ok: true, fill };
}
