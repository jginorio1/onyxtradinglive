// ============================================================
// Matriz de comparación de planes. FUENTE ÚNICA.
//
// La usan el landing y la página /pricing a través de <PlansCompareTable>.
// Antes había dos copias (una en cada sitio) y se desincronizaron: por eso
// /pricing no mostraba Onyx Guardian ni el informe. Si cambias una feature,
// cámbiala aquí y sale igual en los dos lados.
//
// v: [free, pro, elite].  head: fila de subtítulo (sin marcas).
// ============================================================
export type PlanRow = { es: string; en: string; v: (boolean | string)[]; head?: boolean };

export const PLAN_ROWS: PlanRow[] = [
  { es: 'Historial', en: 'History', v: ['30 días', 'Ilimitado', 'Ilimitado'] },
  { es: 'Sesiones y noticias en vivo', en: 'Live sessions & news', v: [true, true, true] },
  { es: 'KPIs, gráficas y calendario', en: 'KPIs, charts & calendar', v: [true, true, true] },
  { es: 'Perfil del trader (radar)', en: 'Trader profile (radar)', v: [true, true, true] },
  { es: 'Diario con fotos y notas', en: 'Journal with photos & notes', v: [false, true, true] },
  { es: 'Comparar cuentas', en: 'Compare accounts', v: [false, true, true] },
  { es: 'Reglas de fondeo y retiros', en: 'Funding rules & payouts', v: [false, true, true] },
  { es: 'Costes (comisión y swap)', en: 'Costs (commission & swap)', v: [false, true, true] },
  { es: 'Exportar CSV', en: 'Export CSV', v: [false, true, true] },

  { es: 'Onyx Guardian', en: 'Onyx Guardian', v: ['', '', ''], head: true },
  { es: 'Break even que cubre costes', en: 'Break even that covers costs', v: [false, true, true] },
  { es: 'Trailing stop', en: 'Trailing stop', v: [false, true, true] },
  { es: 'Mi plan de trading (horarios, rachas)', en: 'My trading plan (hours, streaks)', v: [false, true, true] },
  { es: 'Límites con margen de seguridad', en: 'Limits with safety margin', v: [false, true, true] },
  { es: 'Indicador de disciplina', en: 'Discipline indicator', v: [false, true, true] },
  { es: 'Cierres parciales (varios TP)', en: 'Partial closes (multiple TPs)', v: [false, false, true] },
  { es: 'Bloqueo por noticias', en: 'News blackout', v: [false, false, true] },
  { es: 'Alertas por Telegram', en: 'Telegram alerts', v: [false, false, true] },
  { es: 'Informe semanal por Telegram', en: 'Weekly report on Telegram', v: [false, false, true] },
  { es: 'Soporte prioritario', en: 'Priority support', v: [false, false, true] },
];
