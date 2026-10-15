import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSetting } from '@/lib/settings';

// ============================================================
// Límites de Onyx AI por usuario · tope MENSUAL de consultas por plan + add-on.
// Objetivo: evitar abuso y poder vender un paquete extra. La unidad es el nº de
// consultas (una llamada a la IA = una consulta), que es lo que el usuario entiende.
//   · Tope por plan  → ajuste 'ai_limits' (editable en admin). 0 = ilimitado.
//   · Paquete extra  → profiles.ai_packs × addons.ai_pack_qty (se suma al tope).
// El consumo se cuenta de ai_usage (por user_id) desde el 1 del mes en curso.
// ============================================================

export type AiLimits = Record<string, number>;   // { free: 20, trader: 150, pro: 600, black: 0, default: 150 }

const DEFAULT_LIMITS: AiLimits = { free: 20, default: 150, black: 0 };

export const aiLimitsSetting = () => getSetting<AiLimits>('ai_limits', DEFAULT_LIMITS);

// Inicio del mes en curso (UTC) en ISO, para contar el consumo del período.
function monthStartISO(): string {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)).toISOString();
}

export type Allowance = {
  plan: string; quota: number; extra: number; limit: number;
  used: number; remaining: number; unlimited: boolean; staff: boolean;
  periodStart: string;
};

// Cuánto puede y cuánto lleva este usuario ESTE mes.
export async function aiAllowance(userId: string): Promise<Allowance> {
  const periodStart = monthStartISO();
  const { data: prof } = await supabaseAdmin.from('profiles')
    .select('plan,is_admin,role,ai_packs').eq('id', userId).maybeSingle();
  const plan = (prof as any)?.plan || 'free';
  const staff = !!((prof as any)?.is_admin || (prof as any)?.role);   // el equipo no tiene tope

  const limits = await aiLimitsSetting();
  const quota = Number(limits[plan] ?? limits['default'] ?? 150);

  // Paquete extra comprado (consultas por paquete × nº de paquetes).
  let extra = 0;
  try {
    const { addonSettings } = await import('@/lib/settings');
    const a = await addonSettings();
    extra = Math.max(0, Number((prof as any)?.ai_packs || 0)) * Math.max(0, Number(a.ai_pack_qty || 0));
  } catch {}

  const unlimited = staff || quota === 0;
  const limit = quota + extra;

  // Consumo del mes (nº de llamadas con user_id).
  let used = 0;
  try {
    const { count } = await supabaseAdmin.from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', periodStart);
    used = count || 0;
  } catch { /* si falta la columna user_id, used = 0 */ }

  const remaining = unlimited ? Infinity : Math.max(0, limit - used);
  return { plan, quota, extra, limit, used, remaining, unlimited, staff, periodStart };
}

// Portero: ¿puede hacer una consulta más? Úsalo ANTES de llamar a la IA en las
// rutas de cara al trader. Si devuelve ok:false, muestra el aviso + oferta de add-on.
export async function checkAiLimit(userId: string): Promise<{ ok: boolean; allowance: Allowance }> {
  const allowance = await aiAllowance(userId);
  return { ok: allowance.unlimited || allowance.remaining > 0, allowance };
}
