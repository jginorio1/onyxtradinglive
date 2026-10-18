// Modelo de permisos por área del panel de administración.
export type PermLevel = 'none' | 'view' | 'manage';

// Una fila por módulo: el dueño concede/retira acceso a CADA pestaña del panel
// por separado. El orden sigue los grupos del menú (Inicio, Clientes, Dinero,
// Marketing, Socios, Producto, Equipo, Sistema). Varias pestañas casi idénticas
// comparten una sola área: los tres catálogos de brókers → 'brokers'; las dos
// landing → 'landing'; Guía + Cómo usar → 'guias'.
export const AREAS: { id: string; label: string }[] = [
  // Inicio
  { id: 'resumen', label: 'Resumen' },
  { id: 'monitor', label: 'Command Center' },
  { id: 'notif', label: 'Notificaciones' },
  // Clientes
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'soporte', label: 'Soporte (tickets/chat)' },
  { id: 'baseia', label: 'Base IA' },
  { id: 'correos', label: 'Correos' },
  { id: 'retencion', label: 'Retención' },
  // Dinero
  { id: 'facturacion', label: 'Facturación / Ingresos' },
  { id: 'planes', label: 'Planes' },
  { id: 'pagos', label: 'Pagos y retiros' },
  { id: 'monedero', label: 'Monedero (usuarios)' },
  { id: 'antifraude', label: 'Pagos & chargebacks' },
  { id: 'finanzas', label: 'Finanzas Onyx (P&L)' },
  // Marketing
  { id: 'campanas', label: 'Campañas' },
  { id: 'blog', label: 'Blog' },
  { id: 'seo', label: 'SEO' },
  { id: 'ads', label: 'Publicidad' },
  { id: 'landing', label: 'Landing Builder' },
  // Socios
  { id: 'embajadores', label: 'Embajadores' },
  { id: 'ventas', label: 'Red de ventas' },
  { id: 'copytraders', label: 'Onyx Copy' },
  { id: 'trackrecord', label: 'Trackrecord público' },
  // Producto
  { id: 'modulos', label: 'Módulos' },
  { id: 'academy', label: 'Onyx Academy (mentores/comisiones)' },
  { id: 'botlab', label: 'Onyx Bot Lab' },
  { id: 'factory', label: 'Fábrica de bots' },
  { id: 'firms', label: 'Prop firms' },
  { id: 'catalogos', label: 'Catálogos (países, plataformas…)' },
  { id: 'brokers', label: 'Brókers (MatchTrader/TradeLocker/DXtrade)' },
  // Equipo
  { id: 'equipo', label: 'Equipo' },
  { id: 'nomina', label: 'Nómina' },
  { id: 'carreras', label: 'Carreras' },
  { id: 'formacion', label: 'Formación' },
  { id: 'chat', label: 'Chat de equipo' },
  // Sistema
  { id: 'guias', label: 'Guías (Guía y Cómo usar)' },
  { id: 'diag', label: 'Diagnóstico' },
  { id: 'pruebas', label: 'Pruebas' },
  { id: 'recursos', label: 'Recursos' },
  { id: 'audit', label: 'Auditoría' },
  { id: 'backups', label: 'Backups' },
  { id: 'optim', label: 'Optimización' },
  { id: 'ajustes', label: 'Ajustes' },
];

const rank: Record<PermLevel, number> = { none: 0, view: 1, manage: 2 };

// Roles predefinidos con sus permisos por defecto.
export const ROLES = ['owner', 'admin', 'support', 'marketing', 'custom'] as const;

export function roleDefaults(role?: string | null): Record<string, PermLevel> {
  const all = (lvl: PermLevel) => Object.fromEntries(AREAS.map((a) => [a.id, lvl])) as Record<string, PermLevel>;
  if (role === 'owner') return all('manage');
  // Admin: gestiona casi todo, pero NO el equipo, RR. HH. ni las finanzas del
  // dueño (esas se conceden a mano). Ajustes solo lectura.
  if (role === 'admin') return { ...all('manage'), equipo: 'none', nomina: 'none', carreras: 'none', formacion: 'none', finanzas: 'none', ajustes: 'view' };
  // Soporte: atención al cliente. Gestiona tickets, Base IA y el chat de equipo;
  // ve el Resumen. (Ya NO ve Diagnóstico/Command Center/Pruebas por defecto: si lo
  // necesitas, se concede a mano.)
  if (role === 'support') return { ...all('none'), resumen: 'view', soporte: 'manage', baseia: 'manage', chat: 'manage' };
  // Marketing: crecimiento. Gestiona Campañas, Blog, SEO, Publicidad, Landing,
  // Embajadores, Ventas y Retención; ve Resumen, Usuarios y el Trackrecord.
  if (role === 'marketing') return { ...all('none'), resumen: 'view', usuarios: 'view', correos: 'manage', campanas: 'manage', blog: 'manage', seo: 'manage', ads: 'manage', landing: 'manage', embajadores: 'manage', ventas: 'manage', retencion: 'manage', trackrecord: 'view', chat: 'manage' };
  return all('none'); // custom / sin rol: parte de cero y se define a mano
}

// Permisos efectivos: los del rol, con los overrides personalizados encima.
export function effectivePerms(role?: string | null, custom?: any): Record<string, PermLevel> {
  const base = roleDefaults(role);
  if (custom && typeof custom === 'object') {
    for (const k of Object.keys(custom)) {
      if (rank[custom[k] as PermLevel] !== undefined) base[k] = custom[k];
    }
  }
  return base;
}

export function meets(have: PermLevel | undefined, need: PermLevel): boolean {
  return rank[have || 'none'] >= rank[need];
}

// Compatibilidad de permisos en el SERVIDOR. La matriz del panel ahora es granular
// (una fila por módulo), pero muchísimas rutas de API todavía exigen el área AMPLIA
// original (p. ej. las de Ventas exigen 'embajadores', las de Blog/Bot Lab exigen
// 'modulos'). Para que conceder un área granular también habilite sus rutas sin
// reescribir ~180 endpoints, mapeamos cada área amplia a sus hijas: si alguien tiene
// la hija al nivel pedido, requirePerm del área amplia también pasa.
// Nota: esto es solo autorización de BACKEND; lo que el empleado VE en el menú sigue
// siendo estrictamente por su área (cada pestaña chequea su propia área granular).
export const AREA_CHILDREN: Record<string, string[]> = {
  usuarios: ['correos'],
  soporte: ['baseia'],
  planes: ['facturacion', 'antifraude', 'ads', 'landing'],
  finanzas: ['monedero'],
  embajadores: ['ventas', 'pagos'],
  modulos: ['blog', 'botlab', 'factory', 'brokers'],
  equipo: ['nomina', 'carreras', 'formacion'],
  diag: ['monitor', 'pruebas', 'recursos'],
  ajustes: ['seo', 'backups', 'audit', 'optim'],
};
// ¿El usuario cumple el permiso del área pedida, o de alguna de sus hijas?
export function permMeets(perms: Record<string, PermLevel> | undefined, area: string, need: PermLevel): boolean {
  const p = perms || {};
  if (meets(p[area], need)) return true;
  const kids = AREA_CHILDREN[area];
  return !!kids && kids.some((c) => meets(p[c], need));
}
