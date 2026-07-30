// Modelo de permisos por área del panel de administración.
export type PermLevel = 'none' | 'view' | 'manage';

export const AREAS: { id: string; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'planes', label: 'Planes / Facturación' },
  { id: 'finanzas', label: 'Finanzas Onyx (P&L)' },
  { id: 'academy', label: 'Onyx Academy (mentores/comisiones)' },
  { id: 'campanas', label: 'Campañas' },
  { id: 'embajadores', label: 'Embajadores' },
  { id: 'retencion', label: 'Retención' },
  { id: 'firms', label: 'Prop firms' },
  { id: 'modulos', label: 'Módulos' },
  { id: 'soporte', label: 'Soporte / Chat' },
  { id: 'chat', label: 'Chat de equipo' },
  { id: 'diag', label: 'Diagnóstico' },
  { id: 'equipo', label: 'Equipo' },
  { id: 'ajustes', label: 'Ajustes' },
];

const rank: Record<PermLevel, number> = { none: 0, view: 1, manage: 2 };

// Roles predefinidos con sus permisos por defecto.
export const ROLES = ['owner', 'admin', 'support', 'marketing', 'custom'] as const;

export function roleDefaults(role?: string | null): Record<string, PermLevel> {
  const all = (lvl: PermLevel) => Object.fromEntries(AREAS.map((a) => [a.id, lvl])) as Record<string, PermLevel>;
  if (role === 'owner') return all('manage');
  // Finanzas Onyx es del dueño: ni el rol admin la ve por defecto (se concede a mano).
  if (role === 'admin') return { ...all('manage'), equipo: 'none', ajustes: 'view', finanzas: 'none' };
  if (role === 'support') return { ...all('none'), resumen: 'view', soporte: 'manage', chat: 'manage', diag: 'view' };
  // Marketing: crecimiento. Gestiona Campañas, Embajadores y Retención; ve Resumen y Usuarios.
  if (role === 'marketing') return { ...all('none'), resumen: 'view', usuarios: 'view', campanas: 'manage', embajadores: 'manage', retencion: 'manage', chat: 'manage' };
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
