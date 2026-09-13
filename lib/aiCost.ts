import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { aiPricesSettings, saveSetting, type AiPrices } from '@/lib/settings';

// ============================================================
// Gasto de IA (Anthropic) · registro automático + agregados para Finanzas.
// Cada llamada de la app anota tokens y costo estimado. Es una ESTIMACIÓN por
// tokens (muy cercana a la factura; puede variar por caché o descuentos).
// ============================================================

const DEFAULT_PRICE = { in: 1.0, out: 5.0 };   // USD por 1M de tokens (fallback)

// Precio del modelo desde ajustes (o el 'default'). Los precios cambian, por eso
// se leen de settings y son editables en el panel.
function priceFor(prices: AiPrices, model: string) {
  return prices[model] || prices['default'] || DEFAULT_PRICE;
}

// Anota una llamada. Recibe la RESPUESTA cruda de Anthropic (trae model + usage).
// Fire-and-forget: nunca rompe la función que llama a la IA.
export async function logAiUsage(feature: string, resp: any): Promise<void> {
  try {
    const u = resp?.usage;
    if (!u) return;
    const inTok = Number(u.input_tokens || 0) + Number(u.cache_read_input_tokens || 0) + Number(u.cache_creation_input_tokens || 0);
    const outTok = Number(u.output_tokens || 0);
    if (inTok <= 0 && outTok <= 0) return;
    const model = String(resp?.model || 'default');
    const prices = await aiPricesSettings();
    const p = priceFor(prices, model);
    const costCents = Math.round(((inTok / 1e6) * p.in + (outTok / 1e6) * p.out) * 100);
    await supabaseAdmin.from('ai_usage').insert({
      feature: String(feature || 'otros').slice(0, 30),
      model: model.slice(0, 60),
      input_tokens: inTok, output_tokens: outTok, cost_cents: costCents,
    });
  } catch { /* silencioso: el gasto de IA no debe afectar la respuesta */ }
}

export type AiSpend = {
  totalCents: number; calls: number; tokens: number;
  byFeature: { feature: string; cents: number; calls: number; tokens: number }[];
  byModel: { model: string; cents: number; calls: number }[];
};

// Agregado del gasto de IA en un rango (para el panel y para el P&L).
export async function aiSpend(fromMs: number, toMs: number): Promise<AiSpend> {
  const { data } = await supabaseAdmin.from('ai_usage')
    .select('feature,model,input_tokens,output_tokens,cost_cents,created_at')
    .gte('created_at', new Date(fromMs).toISOString())
    .lte('created_at', new Date(toMs).toISOString());
  const rows = (data || []) as any[];
  const feat: Record<string, { cents: number; calls: number; tokens: number }> = {};
  const mod: Record<string, { cents: number; calls: number }> = {};
  let totalCents = 0, calls = 0, tokens = 0;
  for (const r of rows) {
    const c = Number(r.cost_cents || 0);
    const t = Number(r.input_tokens || 0) + Number(r.output_tokens || 0);
    totalCents += c; calls++; tokens += t;
    (feat[r.feature] ||= { cents: 0, calls: 0, tokens: 0 });
    feat[r.feature].cents += c; feat[r.feature].calls++; feat[r.feature].tokens += t;
    const mk = r.model || 'default';
    (mod[mk] ||= { cents: 0, calls: 0 });
    mod[mk].cents += c; mod[mk].calls++;
  }
  return {
    totalCents, calls, tokens,
    byFeature: Object.entries(feat).map(([feature, v]) => ({ feature, ...v })).sort((a, b) => b.cents - a.cents),
    byModel: Object.entries(mod).map(([model, v]) => ({ model, ...v })).sort((a, b) => b.cents - a.cents),
  };
}

// Costo de IA de un mes concreto en dólares (para sumarlo al P&L).
export async function aiCostForMonth(mStart: number, mEnd: number): Promise<number> {
  const s = await aiSpend(mStart, mEnd);
  return Math.round(s.totalCents) / 100;
}

// Guardar precios (owner). Valida números; conserva 'default'.
export async function saveAiPrices(input: AiPrices): Promise<AiPrices> {
  const clean: AiPrices = {};
  for (const [k, v] of Object.entries(input || {})) {
    const inN = Math.max(0, Number((v as any)?.in) || 0);
    const outN = Math.max(0, Number((v as any)?.out) || 0);
    if (!k) continue;
    clean[k.slice(0, 60)] = { in: inN, out: outN };
  }
  if (!clean['default']) clean['default'] = DEFAULT_PRICE;
  await saveSetting('ai_prices', clean);
  return clean;
}
