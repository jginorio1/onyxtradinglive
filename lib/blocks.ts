import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { BLOCKS } from '@/lib/stratgen';

// ============================================================
// Onyx Bot Factory · Bloques personalizados (creados por Claude)
//  · Una regla de entrada nueva = condiciones sobre indicadores (DSL) que el
//    motor de backtest ejecuta (spec.customEntry).
//  · Amplían la librería fija con reglas ilimitadas, validadas por robustez.
// ============================================================

export type CustomCond = { ind: string; field: 'osc' | 'trend'; op: 'gt' | 'lt' | 'cross_up' | 'cross_dn'; level: number };
export type CustomRule = { conds: CustomCond[]; dir: 'long' | 'short' };
export type CustomBlock = { id: string; block_id: string; es: string; en: string; dsl: CustomRule; notes?: string; origin?: string };

const INDS = new Set(BLOCKS.find((b) => b.key === 'indicators')!.opts.map((o) => o.id));
const OPS = new Set(['gt', 'lt', 'cross_up', 'cross_dn']);

// Valida y limpia una regla DSL (solo indicadores y operadores válidos).
export function validateDsl(d: any): CustomRule | null {
  if (!d || !Array.isArray(d.conds) || !d.conds.length) return null;
  const conds: CustomCond[] = [];
  for (const c of d.conds.slice(0, 4)) {
    const ind = String(c.ind || '');
    const field = c.field === 'trend' ? 'trend' : 'osc';
    const op = OPS.has(c.op) ? c.op : 'gt';
    const level = Number(c.level);
    if (!INDS.has(ind) || isNaN(level)) continue;
    conds.push({ ind, field, op, level });
  }
  if (!conds.length) return null;
  return { conds, dir: d.dir === 'short' ? 'short' : 'long' };
}

function slug(s: string): string { return 'cb_' + (s || 'rule').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 28); }

export async function listBlocks(category = 'entry'): Promise<CustomBlock[]> {
  try {
    const { data } = await supabaseAdmin.from('factory_blocks').select('*').eq('category', category).order('created_at', { ascending: false });
    return (data || []).map((r: any) => ({ id: r.id, block_id: r.block_id, es: r.es, en: r.en, dsl: r.dsl, notes: r.notes, origin: r.origin }));
  } catch { return []; }
}

export async function saveBlock(o: { userId: string; es: string; en: string; dsl: any; notes?: string; origin?: string }) {
  const dsl = validateDsl(o.dsl);
  if (!dsl) throw new Error('La regla no es válida (revisa indicadores y niveles).');
  const block_id = slug(o.es || o.en || 'rule') + '_' + Date.now().toString(36).slice(-4);
  const { data, error } = await supabaseAdmin.from('factory_blocks').insert({
    category: 'entry', block_id, es: (o.es || '').slice(0, 60) || block_id, en: (o.en || o.es || '').slice(0, 60) || block_id,
    dsl, notes: (o.notes || '').slice(0, 400) || null, origin: o.origin === 'custom' ? 'custom' : 'ai', created_by: o.userId,
  }).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteBlock(id: string) { await supabaseAdmin.from('factory_blocks').delete().eq('id', id); return { ok: true }; }
