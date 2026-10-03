// ============================================================
// Catálogo de destinos de Onyx para los botones de los correos.
// Fuente única de verdad: la IA elige de aquí, el editor lo ofrece en un
// desplegable y la validación comprueba contra esto. Rutas reales de la app.
// Módulo PURO (sin dependencias de servidor): se usa en cliente y servidor.
// ============================================================

export const ONYX_BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

// Hosts aceptados (cualquier subdominio de onyxtradinglive.com).
const ONYX_DOMAIN = 'onyxtradinglive.com';

export type Dest = { id: string; es: string; en: string; path: string; group: 'app' | 'web'; when: string };

export const EMAIL_DESTINATIONS: Dest[] = [
  // --- Dentro de la app (trader con sesión) ---
  { id: 'dashboard', es: 'Panel', en: 'Dashboard', path: '/dashboard', group: 'app', when: 'inicio, ver sus números, abrir su panel' },
  { id: 'account', es: 'Tu cuenta', en: 'Your account', path: '/account', group: 'app', when: 'gestionar cuenta, perfil, datos' },
  { id: 'account_plan', es: 'Tu plan', en: 'Your plan', path: '/account#plan', group: 'app', when: 'ver su plan y facturación' },
  { id: 'account_ref', es: 'Referidos', en: 'Referrals', path: '/account#referidos', group: 'app', when: 'invita y gana, sus referidos' },
  { id: 'account_payout', es: 'Retiros', en: 'Withdrawals', path: '/account#retiros', group: 'app', when: 'retirar o cobrar' },
  { id: 'plan_habits', es: 'Mi plan y hábitos', en: 'My plan & habits', path: '/dashboard?view=plan', group: 'app', when: 'plan de trading, hábitos, check-in diario' },
  { id: 'keys', es: 'Conectar cuenta', en: 'Connect account', path: '/dashboard/keys', group: 'app', when: 'conectar/enlazar MetaTrader, cTrader, claves API' },
  { id: 'manager', es: 'Gestor (Guardian)', en: 'Manager (Guardian)', path: '/dashboard/manager', group: 'app', when: 'gestor de riesgo, Onyx Guardian, límites' },
  { id: 'onyx_copy', es: 'Onyx Copy', en: 'Onyx Copy', path: '/dashboard/onyx-copy', group: 'app', when: 'copy trading, seguir estrategias' },
  { id: 'copy', es: 'Copy', en: 'Copy', path: '/dashboard/copy', group: 'app', when: 'copiar operaciones entre cuentas' },
  { id: 'bots', es: 'Mis robots', en: 'My robots', path: '/dashboard/bots', group: 'app', when: 'ver o monitorear sus robots/EAs' },
  { id: 'constructor', es: 'Constructor de robots', en: 'Robot builder', path: '/dashboard/constructor', group: 'app', when: 'crear o construir un robot' },
  { id: 'bot_lab', es: 'Bot Lab', en: 'Bot Lab', path: '/dashboard/bot-lab', group: 'app', when: 'comprar/vender robots (en la app)' },
  { id: 'academy', es: 'Academia', en: 'Academy', path: '/dashboard/academy', group: 'app', when: 'cursos y comunidad (con sesión)' },
  { id: 'expenses', es: 'Ganancia neta', en: 'Net profit', path: '/dashboard/expenses', group: 'app', when: 'gastos, ganancia neta, balance real' },
  { id: 'tradingview', es: 'TradingView', en: 'TradingView', path: '/dashboard/tradingview', group: 'app', when: 'gráficos de TradingView' },
  { id: 'soporte', es: 'Soporte', en: 'Support', path: '/dashboard/soporte', group: 'app', when: 'abrir un ticket, pedir ayuda' },
  { id: 'earnings', es: 'Ganancias', en: 'Earnings', path: '/dashboard/earnings', group: 'app', when: 'ganancias de embajador/copy' },
  { id: 'payout_settings', es: 'Cobros', en: 'Payout settings', path: '/dashboard/payout-settings', group: 'app', when: 'configurar método de cobro' },
  { id: 'ventas', es: 'Ventas', en: 'Sales', path: '/dashboard/ventas', group: 'app', when: 'panel de ventas del equipo' },
  // --- Páginas públicas (leads y no logueados) ---
  { id: 'pricing', es: 'Precios', en: 'Pricing', path: '/pricing', group: 'web', when: 'ver planes, suscribirse, cambiar o renovar plan' },
  { id: 'guia', es: 'Guía', en: 'Guide', path: '/guia', group: 'web', when: 'centro de guías' },
  { id: 'guia_que', es: 'Qué hace Onyx', en: 'What Onyx does', path: '/guia/que-hace-onyx', group: 'web', when: 'explicación general del producto' },
  { id: 'guia_conectar', es: 'Guía: conectar', en: 'Guide: connect', path: '/guia/conectar-cuenta', group: 'web', when: 'cómo conectar la cuenta (guía paso a paso)' },
  { id: 'academia_pub', es: 'Academia (web)', en: 'Academy (web)', path: '/academia', group: 'web', when: 'landing pública de la academia' },
  { id: 'mentores', es: 'Mentores', en: 'Mentors', path: '/mentores', group: 'web', when: 'directorio de mentores' },
  { id: 'copy_pub', es: 'Copy (web)', en: 'Copy (web)', path: '/copy', group: 'web', when: 'landing de copy trading, ranking público' },
  { id: 'botlab_pub', es: 'Bot Lab (web)', en: 'Bot Lab (web)', path: '/bot-lab', group: 'web', when: 'landing pública de Bot Lab' },
  { id: 'propfirms', es: 'Prop firms', en: 'Prop firms', path: '/prop-firms', group: 'web', when: 'información de prop firms' },
  { id: 'embajadores', es: 'Embajadores', en: 'Ambassadors', path: '/embajadores', group: 'web', when: 'programa de embajadores (comisión)' },
  { id: 'invita', es: 'Invita y gana', en: 'Refer & earn', path: '/invita', group: 'web', when: 'programa de referidos de miembro' },
  { id: 'blog', es: 'Blog', en: 'Blog', path: '/blog', group: 'web', when: 'artículos del blog' },
  { id: 'contacto', es: 'Contacto', en: 'Contact', path: '/contacto', group: 'web', when: 'formulario de contacto' },
  { id: 'analiza', es: 'Analiza', en: 'Analyze', path: '/analiza', group: 'web', when: 'analizar un reporte/cuenta con IA' },
  { id: 'carreras', es: 'Carreras', en: 'Careers', path: '/carreras', group: 'web', when: 'vacantes de empleo' },
  { id: 'unete_ventas', es: 'Únete a ventas', en: 'Join sales', path: '/unete-ventas', group: 'web', when: 'reclutamiento de vendedores' },
  { id: 'publicidad', es: 'Publicidad', en: 'Advertising', path: '/publicidad', group: 'web', when: 'anunciarse en Onyx' },
  { id: 'verif_cert', es: 'Verificar certificado', en: 'Verify certificate', path: '/verificar-certificado', group: 'web', when: 'verificar un folio de certificado' },
  { id: 'privacy', es: 'Privacidad', en: 'Privacy', path: '/privacy', group: 'web', when: 'política de privacidad' },
  { id: 'terms', es: 'Términos', en: 'Terms', path: '/terms', group: 'web', when: 'términos y condiciones' },
];

// URL completa de un destino (base + ruta).
export function destUrl(path: string): string {
  const p = String(path || '').trim();
  return ONYX_BASE + (p.startsWith('/') ? p : '/' + p);
}

// ¿El host pertenece a onyxtradinglive.com (o subdominio)?
function hostIsOnyx(host: string): boolean {
  const h = String(host || '').toLowerCase();
  return h === ONYX_DOMAIN || h.endsWith('.' + ONYX_DOMAIN);
}

// ¿Es una variable de plantilla? ({enlace}, {{enlace}}…)
export function isTemplateVar(u: string): boolean {
  return /^\{\{?\s*\w+\s*\}?\}$/.test(String(u || '').trim());
}

// ¿Enlace válido? OK si es variable, mailto, o https de un host de Onyx.
export function isAllowedLink(u: string): boolean {
  const s = String(u || '').trim();
  if (!s) return false;
  if (isTemplateVar(s)) return true;
  if (/^mailto:/i.test(s)) return true;
  if (!/^https?:\/\//i.test(s)) return false;
  try { return hostIsOnyx(new URL(s).hostname); } catch { return false; }
}

// Normaliza/corrige un enlace a algo seguro de Onyx cuando es claramente erróneo.
// - variable o mailto → se deja igual.
// - relativo (/algo) → se antepone la base de Onyx.
// - http(s) con un dominio parecido a Onyx pero equivocado (p. ej.
//   onyxtradingvault.com) → se cambia al dominio correcto conservando la ruta.
// - http(s) ya correcto → https y se deja.
// - un enlace externo legítimo (otro dominio real) → se deja intacto.
export function fixLink(u: string): string {
  let s = String(u || '').trim();
  if (!s) return ONYX_BASE;
  if (isTemplateVar(s) || /^mailto:/i.test(s)) return s;
  if (s.startsWith('/')) return ONYX_BASE + s;
  if (!/^https?:\/\//i.test(s)) {
    // sin esquema: si parece una ruta la pegamos a la base, si no → base.
    return /\s/.test(s) ? ONYX_BASE : ONYX_BASE + '/' + s.replace(/^\/+/, '');
  }
  try {
    const url = new URL(s);
    if (hostIsOnyx(url.hostname)) { url.protocol = 'https:'; return url.toString(); }
    // Dominio parecido a Onyx pero equivocado → corregir al oficial.
    if (/onyxtrading/i.test(url.hostname)) return ONYX_BASE + url.pathname + url.search + url.hash;
    return s;   // externo legítimo: no tocar
  } catch { return ONYX_BASE; }
}

// Etiqueta legible del destino de una URL (para el "Va a: …"), ignorando UTM.
export function destLabel(u: string, es = true): string {
  const s = String(u || '').trim();
  if (isTemplateVar(s)) return es ? 'variable del sistema' : 'system variable';
  try {
    const url = new URL(/^https?:\/\//i.test(s) ? s : destUrl(s));
    const key = (url.pathname + (url.hash || '')).replace(/\/$/, '') || '/dashboard';
    const d = EMAIL_DESTINATIONS.find((x) => {
      const dp = x.path.split('?')[0];
      return dp === key || dp === url.pathname.replace(/\/$/, '');
    });
    return d ? (es ? d.es : d.en) : (es ? 'otra página' : 'another page');
  } catch { return es ? '—' : '—'; }
}

// Bloque de texto con el catálogo para el prompt de la IA.
export function catalogForAI(): string {
  return EMAIL_DESTINATIONS.map((d) => `- ${d.es} → ${destUrl(d.path)}  (cuándo: ${d.when})`).join('\n');
}
