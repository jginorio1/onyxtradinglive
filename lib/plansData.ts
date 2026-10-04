// ============================================================
// Matriz de comparación de planes. FUENTE ÚNICA.
//
// La usan el landing y la página /pricing a través de <PlansCompareTable>.
// Antes había dos copias (una en cada sitio) y se desincronizaron: por eso
// /pricing no mostraba Onyx Guardian ni el informe. Si cambias una feature,
// cámbiala aquí y sale igual en los dos lados.
//
// v: [free, pro, elite, black] → VALOR DE RESPALDO. head: fila de subtítulo.
//
// cap: si está, la marca de cada plan se lee de la capacidad REAL del plan
//      (plan.capabilities[cap]) → la tabla siempre cuadra con los interruptores
//      de Admin → Planes, sin tener que cuidarla a mano.
// dyn: filas numéricas que se leen de campos reales (historial, master, esclava).
// Sin cap ni dyn → usa el valor de respaldo `v` (p. ej. "siempre incluido").
// ============================================================
export type PlanRow = { es: string; en: string; v: (boolean | string)[]; head?: boolean; cap?: string; dyn?: 'history' | 'masters' | 'slaves' };

export const PLAN_ROWS: PlanRow[] = [
  { es: 'Historial', en: 'History', v: ['30 días', 'Ilimitado', 'Ilimitado', 'Ilimitado'], dyn: 'history' },
  { es: 'Sesiones y noticias en vivo', en: 'Live sessions & news', v: [true, true, true, true] },
  { es: 'KPIs, gráficas y calendario', en: 'KPIs, charts & calendar', v: [true, true, true, true] },
  { es: 'Perfil del trader (radar)', en: 'Trader profile (radar)', v: [true, true, true, true] },
  { es: 'Diario con fotos y notas', en: 'Journal with photos & notes', v: [false, true, true, true], cap: 'journal' },
  { es: 'Comparar cuentas', en: 'Compare accounts', v: [false, true, true, true], cap: 'compare' },
  { es: 'Reglas de fondeo y retiros', en: 'Funding rules & payouts', v: [false, true, true, true], cap: 'funding' },
  { es: 'Costes (comisión y swap)', en: 'Costs (commission & swap)', v: [false, true, true, true], cap: 'costs' },
  { es: 'Exportar CSV', en: 'Export CSV', v: [false, true, true, true], cap: 'export' },
  { es: 'Analítica avanzada (Edge)', en: 'Advanced analytics (Edge)', v: [false, true, true, true], cap: 'edge' },
  { es: 'Mi reto (seguimiento prop firm)', en: 'Challenge tracker (prop firm)', v: [false, true, true, true], cap: 'challenge' },
  { es: 'Reporte público / Compartir', en: 'Public report / Share', v: [false, true, true, true], cap: 'share' },
  { es: 'Notificaciones push', en: 'Push notifications', v: [false, true, true, true], cap: 'push' },
  { es: 'Brókers por API (MatchTrader, TradeLocker, DXtrade)', en: 'API brokers (MatchTrader, TradeLocker, DXtrade)', v: [false, true, true, true], cap: 'platforms' },

  { es: 'Onyx Guardian', en: 'Onyx Guardian', v: ['', '', '', ''], head: true },
  { es: 'Break even que cubre costes', en: 'Break even that covers costs', v: [false, true, true, true], cap: 'manager' },
  { es: 'Trailing stop', en: 'Trailing stop', v: [false, true, true, true], cap: 'manager' },
  { es: 'Mi plan de trading (horarios, rachas)', en: 'My trading plan (hours, streaks)', v: [false, true, true, true], cap: 'manager' },
  { es: 'Límites con margen de seguridad', en: 'Limits with safety margin', v: [false, true, true, true], cap: 'manager' },
  { es: 'Indicador de disciplina', en: 'Discipline indicator', v: [false, true, true, true], cap: 'manager' },
  { es: 'Cierres parciales (varios TP)', en: 'Partial closes (multiple TPs)', v: [false, false, true, true], cap: 'manager_advanced' },
  { es: 'Bloqueo por noticias', en: 'News blackout', v: [false, false, true, true], cap: 'manager_news' },
  { es: 'Alertas por Telegram', en: 'Telegram alerts', v: [false, false, true, true], cap: 'telegram' },
  { es: 'Informe semanal por Telegram', en: 'Weekly report on Telegram', v: [false, false, true, true], cap: 'reports' },
  { es: 'Soporte prioritario', en: 'Priority support', v: [false, false, true, true] },

  { es: 'Copy trading', en: 'Copy trading', v: ['', '', '', ''], head: true },
  { es: 'Cuentas Master', en: 'Master accounts', v: [false, false, '1', '∞'], dyn: 'masters' },
  { es: 'Cuentas esclava', en: 'Slave accounts', v: [false, false, '5', '∞'], dyn: 'slaves' },
  { es: 'Control remoto (web y Telegram)', en: 'Remote control (web & Telegram)', v: [false, false, true, true], cap: 'copy' },
  { es: 'Onyx Copy: seguir o ser proveedor', en: 'Onyx Copy: follow or be a provider', v: [false, true, true, true], cap: 'copymkt' },

  { es: 'Onyx Academy (para mentores)', en: 'Onyx Academy (for mentors)', v: ['', '', '', ''], head: true },
  { es: 'Crea tu propia academia', en: 'Create your own academy', v: [false, true, true, true], cap: 'academy' },
  { es: 'Cursos, aulas y progreso', en: 'Courses, classrooms & progress', v: [false, true, true, true], cap: 'academy' },
  { es: 'Comunidad (feed, niveles, ranking)', en: 'Community (feed, levels, ranking)', v: [false, true, true, true], cap: 'academy' },
  { es: 'Clases en vivo (hora local)', en: 'Live classes (local time)', v: [false, true, true, true], cap: 'academy' },
  { es: 'Membresías y niveles de pago', en: 'Memberships & paid tiers', v: [false, true, true, true], cap: 'academy' },
  { es: 'Moderación con IA', en: 'AI moderation', v: [false, true, true, true], cap: 'academy' },
  { es: 'Certificados a tus alumnos', en: 'Certificates for students', v: [false, true, true, true], cap: 'academy' },
  { es: 'Textos con IA (cursos, posts, ventas)', en: 'AI copywriting (courses, posts, sales)', v: [false, true, true, true], cap: 'academy' },
  { es: 'Referidos de alumnos', en: 'Student referrals', v: [false, true, true, true], cap: 'academy' },
  { es: 'Auditoría de alumnos (add-on)', en: 'Student audits (add-on)', v: [false, true, true, true], cap: 'academy' },
  { es: 'Emails automáticos a tus alumnos', en: 'Automated emails to students', v: [false, true, true, true], cap: 'academy' },
  { es: 'Marca propia (logo, colores, redes)', en: 'Your own brand (logo, colors, socials)', v: [false, true, true, true], cap: 'academy' },
  { es: 'Cupones y cobro anual', en: 'Coupons & annual billing', v: [false, true, true, true], cap: 'academy' },
  { es: 'Muro de logros de alumnos', en: 'Student wins wall', v: [false, true, true, true], cap: 'academy' },
  { es: 'Inscripción por rondas y lista de espera', en: 'Cohort enrollment & waitlist', v: [false, true, true, true], cap: 'academy' },
  { es: 'Compatible con móvil', en: 'Works on mobile', v: [false, true, true, true], cap: 'academy' },
  { es: 'Comisión de Onyx por venta', en: 'Onyx fee per sale', v: ['—', '10%', '6%', '3%'] },
];
