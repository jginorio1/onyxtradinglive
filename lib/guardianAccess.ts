import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Onyx Guardian · resolución de acceso.
// Un alumno puede tener Guardian por dos vías, ADEMÁS de su plan de Onyx:
//   1) perk de un nivel VIP de la academia (profiles.academy_guardian = true) → básico
//   2) suscripción de pago dentro de la academia (profiles.academy_guardian_tier)
//        'pro'   → Guardian básico  (manager)
//        'elite' → Guardian completo (manager + advanced + news)
// Esta capa NO otorga copy trading (dinero). Solo el gestor de riesgo.
// ============================================================

export type GuardianTier = 'none' | 'pro' | 'elite';

export type GuardianCaps = { manager?: boolean; manager_advanced?: boolean; manager_news?: boolean };

// Overrides de capacidades a aplicar sobre las del plan, según el perfil.
export function guardianOverride(prof: { academy_guardian?: boolean; academy_guardian_tier?: string } | null | undefined): GuardianCaps {
  if (!prof) return {};
  const tier = (prof.academy_guardian_tier || 'none') as GuardianTier;
  if (tier === 'elite') return { manager: true, manager_advanced: true, manager_news: true };
  if (tier === 'pro') return { manager: true };
  if (prof.academy_guardian) return { manager: true };   // perk regalado por el mentor
  return {};
}

// Estado que ve el alumno: qué Guardian tiene ya (por plan o por academia) para
// no ofrecerle lo que ya posee. Devuelve el "nivel efectivo" más alto.
export async function guardianStatus(userId: string): Promise<{ tier: GuardianTier; fromPlan: boolean; hasManager: boolean; hasElite: boolean }> {
  const { data: prof } = await supabaseAdmin.from('profiles')
    .select('plan,academy_guardian,academy_guardian_tier').eq('id', userId).maybeSingle() as any;
  const { data: plan } = await supabaseAdmin.from('plans')
    .select('capabilities').eq('id', prof?.plan || 'free').maybeSingle() as any;
  const caps = plan?.capabilities || {};
  const ov = guardianOverride(prof);
  const hasManager = !!(caps.manager || ov.manager);
  const hasElite = !!((caps.manager && caps.manager_advanced && caps.manager_news) || ov.manager_advanced);
  const tier: GuardianTier = (prof?.academy_guardian_tier || 'none') as GuardianTier;
  return { tier, fromPlan: !!caps.manager, hasManager, hasElite };
}

// El webhook activa el nivel comprado y guarda la suscripción que lo respalda.
export async function setGuardianTier(userId: string, tier: GuardianTier, subId?: string | null) {
  const patch: any = { academy_guardian_tier: tier };
  if (subId !== undefined) patch.academy_guardian_sub_id = subId;
  await supabaseAdmin.from('profiles').update(patch).eq('id', userId);
}

// Al cancelar/no pagar, se localiza por la suscripción y se apaga Guardian.
export async function revokeGuardianBySub(subId: string) {
  if (!subId) return;
  await supabaseAdmin.from('profiles')
    .update({ academy_guardian_tier: 'none', academy_guardian_sub_id: null })
    .eq('academy_guardian_sub_id', subId);
}
