// ============================================================
// Matriz de comparación de planes. FUENTE ÚNICA.
//
// La usan el landing y la página /pricing a través de <PlansCompareTable>.
// Antes había dos copias (una en cada sitio) y se desincronizaron: por eso
// /pricing no mostraba Onyx Guardian ni el informe. Si cambias una feature,
// cámbiala aquí y sale igual en los dos lados.
//
// v: [free, pro, elite, black].  head: fila de subtítulo (sin marcas).
// ============================================================
export type PlanRow = { es: string; en: string; v: (boolean | string)[]; head?: boolean };

export const PLAN_ROWS: PlanRow[] = [
  { es: 'Historial', en: 'History', v: ['30 días', 'Ilimitado', 'Ilimitado', 'Ilimitado'] },
  { es: 'Sesiones y noticias en vivo', en: 'Live sessions & news', v: [true, true, true, true] },
  { es: 'KPIs, gráficas y calendario', en: 'KPIs, charts & calendar', v: [true, true, true, true] },
  { es: 'Perfil del trader (radar)', en: 'Trader profile (radar)', v: [true, true, true, true] },
  { es: 'Diario con fotos y notas', en: 'Journal with photos & notes', v: [false, true, true, true] },
  { es: 'Comparar cuentas', en: 'Compare accounts', v: [false, true, true, true] },
  { es: 'Reglas de fondeo y retiros', en: 'Funding rules & payouts', v: [false, true, true, true] },
  { es: 'Costes (comisión y swap)', en: 'Costs (commission & swap)', v: [false, true, true, true] },
  { es: 'Exportar CSV', en: 'Export CSV', v: [false, true, true, true] },

  { es: 'Onyx Guardian', en: 'Onyx Guardian', v: ['', '', '', ''], head: true },
  { es: 'Break even que cubre costes', en: 'Break even that covers costs', v: [false, true, true, true] },
  { es: 'Trailing stop', en: 'Trailing stop', v: [false, true, true, true] },
  { es: 'Mi plan de trading (horarios, rachas)', en: 'My trading plan (hours, streaks)', v: [false, true, true, true] },
  { es: 'Límites con margen de seguridad', en: 'Limits with safety margin', v: [false, true, true, true] },
  { es: 'Indicador de disciplina', en: 'Discipline indicator', v: [false, true, true, true] },
  { es: 'Cierres parciales (varios TP)', en: 'Partial closes (multiple TPs)', v: [false, false, true, true] },
  { es: 'Bloqueo por noticias', en: 'News blackout', v: [false, false, true, true] },
  { es: 'Alertas por Telegram', en: 'Telegram alerts', v: [false, false, true, true] },
  { es: 'Informe semanal por Telegram', en: 'Weekly report on Telegram', v: [false, false, true, true] },
  { es: 'Soporte prioritario', en: 'Priority support', v: [false, false, true, true] },

  { es: 'Copy trading', en: 'Copy trading', v: ['', '', '', ''], head: true },
  { es: 'Cuentas Master', en: 'Master accounts', v: [false, false, '1', '∞'] },
  { es: 'Cuentas esclava', en: 'Slave accounts', v: [false, false, '5', '∞'] },
  { es: 'Control remoto (web y Telegram)', en: 'Remote control (web & Telegram)', v: [false, false, true, true] },

  { es: 'Onyx Academy (para mentores)', en: 'Onyx Academy (for mentors)', v: ['', '', '', ''], head: true },
  { es: 'Crea tu propia academia', en: 'Create your own academy', v: [false, true, true, true] },
  { es: 'Cursos, aulas y progreso', en: 'Courses, classrooms & progress', v: [false, true, true, true] },
  { es: 'Comunidad (feed, niveles, ranking)', en: 'Community (feed, levels, ranking)', v: [false, true, true, true] },
  { es: 'Clases en vivo (hora local)', en: 'Live classes (local time)', v: [false, true, true, true] },
  { es: 'Membresías y niveles de pago', en: 'Memberships & paid tiers', v: [false, true, true, true] },
  { es: 'Moderación con IA', en: 'AI moderation', v: [false, true, true, true] },
  { es: 'Certificados a tus alumnos', en: 'Certificates for students', v: [false, true, true, true] },
  { es: 'Textos con IA (cursos, posts, ventas)', en: 'AI copywriting (courses, posts, sales)', v: [false, true, true, true] },
  { es: 'Referidos de alumnos', en: 'Student referrals', v: [false, true, true, true] },
  { es: 'Auditoría de alumnos (add-on)', en: 'Student audits (add-on)', v: [false, true, true, true] },
  { es: 'Emails automáticos a tus alumnos', en: 'Automated emails to students', v: [false, true, true, true] },
  { es: 'Marca propia (logo, colores, redes)', en: 'Your own brand (logo, colors, socials)', v: [false, true, true, true] },
  { es: 'Cupones y cobro anual', en: 'Coupons & annual billing', v: [false, true, true, true] },
  { es: 'Muro de logros de alumnos', en: 'Student wins wall', v: [false, true, true, true] },
  { es: 'Inscripción por rondas y lista de espera', en: 'Cohort enrollment & waitlist', v: [false, true, true, true] },
  { es: 'Onyx Guardian VIP para tus niveles', en: 'Onyx Guardian VIP for your tiers', v: [false, true, true, true] },
  { es: 'Compatible con móvil', en: 'Works on mobile', v: [false, true, true, true] },
  { es: 'Comisión de Onyx por venta', en: 'Onyx fee per sale', v: ['—', '10%', '6%', '3%'] },
];
