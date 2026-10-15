import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSetting } from '@/lib/settings';

// ============================================================
// Límites de Onyx AI por usuario · tope MENSUAL de consultas por plan + add-on.
// Objetivo: evitar abuso y poder vender un paquete extra. La unidad es el nº de
// consultas (una llamada a la IA = una consulta), que es lo que el usuario entiende.
//   · Tope por plan  → ajuste 'ai_limits' (editable en admin). 0 = ilimitado.
//   · Paquete extra  → PAGO ÚNICO: filas en 'ai_packs' del mes en curso (consumible,
//     no recurre, no se arrastra). Se suman al tope solo ese mes.
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
    .select('plan,is_admin,role').eq('id', userId).maybeSingle();
  const plan = (prof as any)?.plan || 'free';
  const staff = !!((prof as any)?.is_admin || (prof as any)?.role);   // el equipo no tiene tope

  const limits = await aiLimitsSetting();
  const quota = Number(limits[plan] ?? limits['default'] ?? 150);

  // Paquetes extra COMPRADOS este mes (pago único, consumible). Suma de 'ai_packs'
  // del período en curso; el mes siguiente arranca en 0 (no se arrastra).
  let extra = 0;
  try {
    const period = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
    const { data } = await supabaseAdmin.from('ai_packs').select('qty').eq('user_id', userId).eq('period', period);
    extra = (data || []).reduce((s: number, r: any) => s + Number(r.qty || 0), 0);
  } catch { /* si la tabla no existe aún, extra = 0 */ }

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
