// ============================================================
// Fuente ÚNICA de los "hechos de venta" de los planes.
//
// Todo lo que mencione la prueba gratis o el ahorro anual (tarjetas, tabla
// comparativa, FAQs, guía, Support AI) lee de aquí, así los números nunca
// se contradicen. Cambias los días en Admin → Planes y se actualiza en todas
// partes; si pones 0, la prueba desaparece de todas las superficies.
// Nada de números fijos: todo se calcula desde los planes reales.
// ============================================================
export type PlanLike = {
  id: string; name?: string; name_en?: string;
  price_month?: number; price_year?: number;
  capabilities?: any;
};

export type PlanFacts = {
  // Prueba gratis
  trialDays: number;          // días de la mejor prueba (0 = no hay prueba en ningún plan)
  trialPlanId: string;        // plan al que aplica esa prueba
  trialPlanName: string;      // nombre del plan (ES)
  trialPlanNameEn: string;    // nombre del plan (EN)
  hasTrial: boolean;          // trialDays > 0
  trialAllPaid: boolean;      // TODOS los planes de pago tienen la misma prueba (> 0)
  // Ahorro anual (del plan de pago más representativo: la mejor prueba, o el más barato de pago)
  annualPct: number;          // % de ahorro al pagar anual vs 12 meses (0 si no aplica)
  annualMonthsFree: number;   // meses "gratis" equivalentes al año (redondeado)
};

// Días de prueba de UN plan (0 si no tiene). Tolerante a datos sucios.
export function trialDaysOf(p: PlanLike): number {
  const d = Math.round(Number(p?.capabilities?.trial_days) || 0);
  return Math.max(0, Math.min(90, d));
}

// % de ahorro anual de UN plan (0 si no aplica).
export function annualPctOf(p: PlanLike): number {
  const pm = Number(p?.price_month) || 0;
  const py = Number(p?.price_year) || 0;
  if (pm <= 0 || py <= 0) return 0;
  const full = pm * 12;
  if (full <= py) return 0;
  return Math.round((1 - py / full) * 100);
}

// Resume los hechos de venta a partir de la lista de planes.
export function planFacts(plans: PlanLike[] | null | undefined): PlanFacts {
  const list = Array.isArray(plans) ? plans : [];

  // Mejor prueba = la de más días entre los planes de pago.
  let best: PlanLike | null = null;
  let bestDays = 0;
  for (const p of list) {
    const d = trialDaysOf(p);
    if (d > bestDays) { bestDays = d; best = p; }
  }

  // Plan de referencia para el ahorro anual: el de la prueba si existe; si no,
  // el plan de pago más barato (price_month > 0).
  let refForAnnual: PlanLike | null = best;
  if (!refForAnnual) {
    const paid = list.filter((p) => (Number(p.price_month) || 0) > 0)
      .sort((a, b) => (Number(a.price_month) || 0) - (Number(b.price_month) || 0));
    refForAnnual = paid[0] || null;
  }
  const annualPct = refForAnnual ? annualPctOf(refForAnnual) : 0;
  // Meses gratis equivalentes: 12 − (año / mes). Redondeado.
  let annualMonthsFree = 0;
  if (refForAnnual) {
    const pm = Number(refForAnnual.price_month) || 0;
    const py = Number(refForAnnual.price_year) || 0;
    if (pm > 0 && py > 0 && py < pm * 12) annualMonthsFree = Math.round(12 - py / pm);
  }

  // ¿Todos los planes de pago comparten la MISMA prueba (> 0)? Si es así, el copy
  // dice "en todos los planes de pago" en vez de nombrar uno solo (p. ej. Builder).
  const paidPlans = list.filter((p) => (Number(p.price_month) || 0) > 0 || (Number(p.price_year) || 0) > 0);
  const trialAllPaid = bestDays > 0 && paidPlans.length > 1 && paidPlans.every((p) => trialDaysOf(p) === bestDays);

  return {
    trialDays: bestDays,
    trialPlanId: best?.id || '',
    trialPlanName: best?.name || '',
    trialPlanNameEn: best?.name_en || best?.name || '',
    hasTrial: bestDays > 0,
    trialAllPaid,
    annualPct,
    annualMonthsFree,
  };
}

// Frase corta y lista para pintar: "7 días gratis en Guardian Pro" / "".
export function trialLine(f: PlanFacts, lang: 'es' | 'en'): string {
  if (!f.hasTrial) return '';
  // Si todos los planes de pago comparten la prueba, lo decimos genérico (lee los
  // días en vivo); si no, nombramos el plan que la tiene.
  if (f.trialAllPaid) {
    return lang === 'es'
      ? `${f.trialDays} días gratis en todos los planes de pago`
      : `${f.trialDays}-day free trial on all paid plans`;
  }
  const nm = lang === 'es' ? f.trialPlanName : f.trialPlanNameEn;
  return lang === 'es'
    ? `${f.trialDays} días gratis${nm ? ` en ${nm}` : ''}`
    : `${f.trialDays}-day free trial${nm ? ` on ${nm}` : ''}`;
}
