// Modelo de permisos por área del panel de administración.
export type PermLevel = 'none' | 'view' | 'manage';

// Una fila por módulo: el dueño concede/retira acceso a CADA pestaña del panel
// por separado. El orden sigue los grupos del menú (Inicio, Clientes, Dinero,
// Marketing, Socios, Producto, Equipo, Sistema). Varias pestañas casi idénticas
// comparten una sola área: los tres catálogos de brókers → 'brokers'; las dos
// landing → 'landing'; Guía + Cómo usar → 'guias'.
// Grupos de la matriz de permisos (mismo orden y nombres que el menú del panel).
// Cada área pertenece a uno; la UI los pinta como secciones plegables para que la
// lista no se vea como una sola fila larguísima hacia abajo.
export const AREA_GROUPS: { id: string; es: string; en: string; emoji: string }[] = [
  { id: 'inicio', es: 'Inicio', en: 'Home', emoji: '🏠' },
  { id: 'clientes', es: 'Clientes', en: 'Customers', emoji: '👥' },
  { id: 'dinero', es: 'Dinero', en: 'Money', emoji: '💰' },
  { id: 'marketing', es: 'Marketing', en: 'Marketing', emoji: '📣' },
  { id: 'socios', es: 'Socios', en: 'Partners', emoji: '🤝' },
  { id: 'producto', es: 'Producto', en: 'Product', emoji: '🧩' },
  { id: 'equipo', es: 'Equipo', en: 'Team', emoji: '🛡️' },
  { id: 'sistema', es: 'Sistema', en: 'System', emoji: '⚙️' },
];

export const AREAS: { id: string; label: string; group: string }[] = [
  // Inicio
  { id: 'resumen', label: 'Resumen', group: 'inicio' },
  { id: 'monitor', label: 'Command Center', group: 'inicio' },
  { id: 'notif', label: 'Notificaciones', group: 'inicio' },
  // Clientes
  { id: 'usuarios', label: 'Usuarios', group: 'clientes' },
  { id: 'soporte', label: 'Soporte (tickets/chat)', group: 'clientes' },
  { id: 'baseia', label: 'Base IA', group: 'clientes' },
  { id: 'correos', label: 'Correos', group: 'clientes' },
  { id: 'retencion', label: 'Retención', group: 'clientes' },
  // Dinero
  { id: 'facturacion', label: 'Facturación / Ingresos', group: 'dinero' },
  { id: 'planes', label: 'Planes', group: 'dinero' },
  { id: 'pagos', label: 'Pagos y retiros', group: 'dinero' },
  { id: 'monedero', label: 'Monedero (usuarios)', group: 'dinero' },
  { id: 'antifraude', label: 'Pagos & chargebacks', group: 'dinero' },
  { id: 'finanzas', label: 'Finanzas Onyx (P&L)', group: 'dinero' },
  // Marketing
  { id: 'campanas', label: 'Campañas', group: 'marketing' },
  { id: 'blog', label: 'Blog', group: 'marketing' },
  { id: 'seo', label: 'SEO', group: 'marketing' },
  { id: 'ads', label: 'Publicidad', group: 'marketing' },
  { id: 'landing', label: 'Landing Builder', group: 'marketing' },
  // Socios
  { id: 'embajadores', label: 'Embajadores', group: 'socios' },
  { id: 'ventas', label: 'Red de ventas', group: 'socios' },
  { id: 'copytraders', label: 'Onyx Copy', group: 'socios' },
  { id: 'trackrecord', label: 'Trackrecord público', group: 'socios' },
  // Producto
  { id: 'modulos', label: 'Módulos', group: 'producto' },
  { id: 'academy', label: 'Onyx Academy (mentores/comisiones)', group: 'producto' },
  { id: 'botlab', label: 'Onyx Bot Lab', group: 'producto' },
  { id: 'factory', label: 'Fábrica de bots', group: 'producto' },
  { id: 'firms', label: 'Prop firms', group: 'producto' },
  { id: 'catalogos', label: 'Catálogos (países, plataformas…)', group: 'producto' },
  { id: 'brokers', label: 'Brókers (MatchTrader/TradeLocker/DXtrade)', group: 'producto' },
  // Equipo
  { id: 'equipo', label: 'Equipo', group: 'equipo' },
  { id: 'nomina', label: 'Nómina', group: 'equipo' },
  { id: 'carreras', label: 'Carreras', group: 'equipo' },
  { id: 'formacion', label: 'Formación', group: 'equipo' },
  { id: 'chat', label: 'Chat de equipo', group: 'equipo' },
  // Sistema
  { id: 'guias', label: 'Guías (Guía y Cómo usar)', group: 'sistema' },
  { id: 'diag', label: 'Diagnóstico', group: 'sistema' },
  { id: 'pruebas', label: 'Pruebas', group: 'sistema' },
  { id: 'recursos', label: 'Recursos', group: 'sistema' },
  { id: 'audit', label: 'Auditoría', group: 'sistema' },
  { id: 'backups', label: 'Backups', group: 'sistema' },
  { id: 'optim', label: 'Optimización', group: 'sistema' },
  { id: 'ajustes', label: 'Ajustes', group: 'sistema' },
];

const rank: Record<PermLevel, number> = { none: 0, view: 1, manage: 2 };

// ─── Permisos FINOS de acciones sobre un usuario ──────────────────────────────
// Además del nivel del módulo "Usuarios" (ver / gestionar), cada acción sensible
// sobre un cliente se concede por separado. Así puedes tener un empleado que
// administra usuarios pero NO puede, p. ej., resetear PIN ni borrar.
// Se guardan en perms con la clave `usuarios.<id>` = 'manage' (concedida) o ausente.
export const USER_ACTIONS: { id: string; es: string; en: string }[] = [
  { id: 'edit', es: 'Editar perfil (nombre, reenviar confirmación)', en: 'Edit profile (name, resend confirmation)' },
  { id: 'password', es: 'Restablecer contraseña', en: 'Reset password' },
  { id: 'plan', es: 'Cambiar plan / dar cortesía', en: 'Change plan / grant comp' },
  { id: 'pin', es: 'Resetear PIN de Onyx Copy', en: 'Reset Onyx Copy PIN' },
  { id: 'ban', es: 'Banear / desbanear', en: 'Ban / unban' },
  { id: 'admin', es: 'Hacer / quitar administrador', en: 'Grant / revoke admin' },
  { id: 'delete', es: 'Borrar usuario (definitivo)', en: 'Delete user (permanent)' },
];

// ¿Este admin puede ejecutar la acción `action` sobre un usuario? El dueño siempre.
// 'edit' se cubre con el nivel manage del módulo Usuarios (acciones de bajo riesgo).
// Las demás (plan, pin, ban, admin, delete) exigen su concesión específica.
export function canUserAction(role: string | null | undefined, perms: Record<string, PermLevel> | undefined, action: string): boolean {
  if (role === 'owner') return true;
  const p = perms || {};
  if (p['usuarios.' + action] === 'manage') return true;
  if (action === 'edit' && meets(p['usuarios'], 'manage')) return true;
  return false;
}

// Roles predefinidos con sus permisos por defecto.
export const ROLES = ['owner', 'admin', 'support', 'marketing', 'custom'] as const;

export function roleDefaults(role?: string | null): Record<string, PermLevel> {
  const all = (lvl: PermLevel) => Object.fromEntries(AREAS.map((a) => [a.id, lvl])) as Record<string, PermLevel>;
  if (role === 'owner') return all('manage');
  // Admin: gestiona casi todo, pero NO el equipo, RR. HH. ni las finanzas del
  // dueño (esas se conceden a mano). Ajustes solo lectura.
  if (role === 'admin') return { ...all('manage'), equipo: 'none', nomina: 'none', carreras: 'none', formacion: 'none', finanzas: 'none', ajustes: 'view', ...Object.fromEntries(USER_ACTIONS.map((a) => ['usuarios.' + a.id, 'manage'])) };
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
