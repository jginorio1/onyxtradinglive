// Etiqueta corta de prueba gratis para los mensajes de "mejora tu plan".
// Lee los días de prueba del plan destino (capabilities.trial_days). Si es 0
// devuelve '' y la UI no muestra nada (plan sin prueba → mensaje igual que antes).
//
//   trialTag(7, 'es')  -> '7 días gratis'
//   trialTag(1, 'en')  -> '1 day free'
//   trialTag(0, 'es')  -> ''  (sin prueba)
export function trialDays(plan: any): number {
  return Math.max(0, Math.min(90, Math.round(Number(plan?.capabilities?.trial_days) || 0)));
}

export function trialTag(days: any, lang?: string): string {
  const d = Math.max(0, Math.round(Number(days) || 0));
  if (!d) return '';
  const es = lang !== 'en';
  return es ? `${d} ${d === 1 ? 'día' : 'días'} gratis` : `${d} ${d === 1 ? 'day' : 'days'} free`;
}
