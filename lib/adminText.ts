'use client';
import { useLang } from './lang';

// Traducciones del panel de administración (ES/EN).
// Un único diccionario; cada componente cliente llama useT() y usa t.clave.
// Los textos con número se arman en el componente combinando estas piezas.

const ES = {
  // Menú lateral
  brand: 'Onyx Admin',
  g_op: 'Operación', g_prod: 'Producto', g_growth: 'Crecimiento', g_sys: 'Sistema',
  nav_resumen: 'Resumen', nav_usuarios: 'Usuarios', nav_soporte: 'Soporte', nav_equipo: 'Equipo',
  nav_planes: 'Planes', nav_modulos: 'Módulos', nav_firms: 'Prop firms',
  nav_embajadores: 'Embajadores', nav_retencion: 'Retención',
  nav_kb: 'Base IA', nav_diag: 'Diagnóstico', nav_pruebas: 'Pruebas', nav_ajustes: 'Ajustes',
  avail_on: 'Disponible', avail_off: 'Ausente',

  // Cabeceras de pestaña
  h_resumen_t: 'Resumen', h_resumen_s: 'El pulso del negocio y lo que necesita tu atención.',
  h_usuarios_t: 'Usuarios', h_usuarios_registered: 'registrados · busca y gestiona.',
  h_soporte_t: 'Soporte', h_soporte_s: 'Cola compartida — toma, responde, invita a un compañero.',
  h_equipo_t: 'Equipo y permisos', h_equipo_s: 'Añade miembros, asigna un rol y afina permisos por área.',
  h_equipo_s_ro: 'Solo quien gestiona el equipo puede cambiar roles.',
  h_planes_t: 'Planes', h_planes_s: 'Precios, funciones y capacidades reales de cada plan.',
  h_modulos_t: 'Módulos', h_modulos_s: 'Estado en vivo de las capacidades del sistema.',
  h_firms_t: 'Prop firms', h_firms_s: 'Plantillas que ve el trader al configurar límites. Corrige aquí y todos las ven.',
  h_embajadores_t: 'Embajadores', h_embajadores_s: 'Programa de referidos, comisiones y pagos.',
  h_retencion_t: 'Retención', h_retencion_s: 'Rescata a quien intenta irse y mide por qué.',
  h_kb_t: 'Base de conocimiento IA', h_kb_s: 'Lo que escribas aquí lo usa Onyx AI para responder, además de la Guía.',
  h_diag_t: 'Diagnóstico', h_diag_s: 'Salud del sistema y qué falta configurar.',
  h_pruebas_t: 'Consola de pruebas', h_pruebas_s: 'Simula lo que envía el EA, sin abrir MetaTrader: clave, límites y configuración de Onyx Guardian.',
  h_ajustes_t: 'Ajustes', h_ajustes_s: 'Tu rol, administradores y cómo se organiza el acceso.',

  // Resumen
  r_mrr: 'MRR estimado', r_paying: 'de pago', r_conversion: 'conversión',
  r_users: 'Usuarios', r_mtAccounts: 'cuentas MT', r_trades: 'operaciones',
  r_team: 'Equipo', r_availableNow: 'disponibles ahora', r_availableNow1: 'disponible ahora',
  r_banned: 'Baneados',
  r_needs: 'Necesita tu atención', r_allGood: 'Todo en orden', r_noPending: ' — sin pendientes por ahora.',
  r_sqlMissing: 'migración(es) SQL sin correr', r_seeDiag: 'Ver Diagnóstico',
  r_ticketsOpen: 'ticket(s) de soporte abierto(s)', r_openQueue: 'Abrir cola',
  r_svcConfig: 'servicio(s) por configurar', r_review: 'Revisar',
  r_bannedUsers: 'usuario(s) baneado(s)', r_seeUsers: 'Ver usuarios',

  // Usuarios (tabla)
  u_search: 'Buscar por email…', u_admin: 'admin',
  u_active: 'activo', u_banned: 'baneado',
  u_unban: 'Desbanear', u_makeAdmin: 'Hacer admin', u_removeAdmin: 'Quitar admin',

  // Equipo
  t_you: ' (tú)', t_lastActivity: 'Últ. actividad: ', t_noActivity: 'Sin actividad',
  t_perms: 'Permisos', t_close: 'Cerrar', t_remove: 'Quitar',
  t_permsByArea: 'Permisos por área', t_permsHint: '· el rol pone valores por defecto; aquí los afinas',
  t_invite: 'Invitar miembro (debe estar registrado en la app)',
  t_invitePh: 'email@ejemplo.com', t_inviteBtn: '+ Invitar',
  t_activity: 'Registro de actividad', t_member: 'Miembro:', t_all: 'Todos',
  t_noActivityTopic: 'Sin actividad en este tema.',
  lvl_none: 'Sin acceso', lvl_view: 'Ver', lvl_manage: 'Gestionar',
  role_owner: 'Owner', role_admin: 'Admin', role_support: 'Soporte', role_marketing: 'Marketing', role_custom: 'Personalizado',
  lt_all: 'Todos', lt_equipo: 'Equipo', lt_soporte: 'Soporte', lt_baseia: 'Base IA', lt_usuarios: 'Usuarios', lt_planes: 'Planes',

  // Soporte (helpdesk)
  s_open: 'Abiertos', s_inprogress: 'En curso', s_resolved: 'Resueltos', s_all: 'Todos',
  s_search: 'Buscar por correo o asunto…', s_empty: 'No hay conversaciones en esta vista.',
  s_pickOne: 'Elige una conversación de la izquierda para verla aquí.',
  s_unassigned: 'sin asignar', s_assignedTo: 'asignado a ',
  s_visitor: 'Visitante', s_inConvo: 'En la conversación: ',
  s_reply: 'Responder', s_note: 'Nota interna', s_notePh: 'Nota que solo ve el equipo…',
  s_replyPh: 'Respuesta para el trader (le llega por correo)…',
  s_sendReply: 'Enviar respuesta', s_saveNote: 'Guardar nota', s_aiDraft: 'Borrador IA',
  s_take: 'Tomar', s_resolve: 'Resolver', s_reopen: 'Reabrir',
  s_invitePh: 'Invitar compañero (su email de equipo)', s_inviteBtn: 'Invitar',
  st_open: 'Abierto', st_inprogress: 'En curso', st_resolved: 'Resuelto',
  sender_trader: 'Trader', sender_note: '🔒 Nota interna', sender_support: 'Soporte',
  ch_ticket: 'Ticket', ch_chat: 'Chat', ch_lead: 'Lead', ch_email: 'Email',
  cat_general: 'General', cat_conexion: 'Conexión', cat_instalacion: 'Instalación', cat_guardian: 'Onyx Guardian', cat_facturacion: 'Facturación',

  // Diagnóstico
  d_refresh: '↻ Refrescar', d_loading: 'Cargando diagnóstico…',
  d_quickTests: '⚡ Pruebas rápidas', d_testAI: '🤖 Probar IA', d_testEmail: '📧 Enviar correo de prueba', d_testTG: '✈️ Probar Telegram',
  d_db: '🗄️ Base de datos (¿corriste los SQL?)', d_applied: '✓ aplicado', d_missing: '✗ falta correr',
  d_missingMsg: 'Te falta correr en Supabase → SQL Editor: ',
  d_recentErrors: '🚨 Errores recientes', d_noErrors: 'Sin errores registrados. 🎉',
  d_commonErrors: '📖 Errores comunes explicados',

  // Ajustes
  a_yourRole: 'Tu rol', a_rolesTitle: 'Cómo funcionan los roles',
  a_rolesBody: 'El Owner controla planes, usuarios y equipo. Los Admin gestionan usuarios y planes. El Soporte solo consulta y ayuda.',
  a_rolesEnv: 'Los correos de ADMIN_EMAILS en Vercel siempre entran como Owner. Puedes añadir más administradores desde la pestaña Equipo.',
};

type Dict = typeof ES;

const EN: Dict = {
  brand: 'Onyx Admin',
  g_op: 'Operations', g_prod: 'Product', g_growth: 'Growth', g_sys: 'System',
  nav_resumen: 'Overview', nav_usuarios: 'Users', nav_soporte: 'Support', nav_equipo: 'Team',
  nav_planes: 'Plans', nav_modulos: 'Modules', nav_firms: 'Prop firms',
  nav_embajadores: 'Ambassadors', nav_retencion: 'Retention',
  nav_kb: 'AI Base', nav_diag: 'Diagnostics', nav_pruebas: 'Tests', nav_ajustes: 'Settings',
  avail_on: 'Available', avail_off: 'Away',

  h_resumen_t: 'Overview', h_resumen_s: 'Your business pulse and what needs attention.',
  h_usuarios_t: 'Users', h_usuarios_registered: 'registered · search and manage.',
  h_soporte_t: 'Support', h_soporte_s: 'Shared queue — take, reply, invite a teammate.',
  h_equipo_t: 'Team and permissions', h_equipo_s: 'Add members, assign a role and fine-tune permissions by area.',
  h_equipo_s_ro: 'Only someone who manages the team can change roles.',
  h_planes_t: 'Plans', h_planes_s: 'Prices, features and real capabilities of each plan.',
  h_modulos_t: 'Modules', h_modulos_s: 'Live status of the system capabilities.',
  h_firms_t: 'Prop firms', h_firms_s: 'Templates the trader sees when setting limits. Fix here and everyone gets it.',
  h_embajadores_t: 'Ambassadors', h_embajadores_s: 'Referral program, commissions and payouts.',
  h_retencion_t: 'Retention', h_retencion_s: 'Save those trying to leave and measure why.',
  h_kb_t: 'AI knowledge base', h_kb_s: 'What you write here is used by Onyx AI to answer, alongside the Guide.',
  h_diag_t: 'Diagnostics', h_diag_s: 'System health and what still needs setup.',
  h_pruebas_t: 'Test console', h_pruebas_s: 'Simulate what the EA sends, without opening MetaTrader: key, limits and Onyx Guardian config.',
  h_ajustes_t: 'Settings', h_ajustes_s: 'Your role, admins and how access is organized.',

  r_mrr: 'Estimated MRR', r_paying: 'paying', r_conversion: 'conversion',
  r_users: 'Users', r_mtAccounts: 'MT accounts', r_trades: 'trades',
  r_team: 'Team', r_availableNow: 'available now', r_availableNow1: 'available now',
  r_banned: 'Banned',
  r_needs: 'Needs your attention', r_allGood: 'All clear', r_noPending: ' — nothing pending for now.',
  r_sqlMissing: 'SQL migration(s) not run', r_seeDiag: 'View Diagnostics',
  r_ticketsOpen: 'open support ticket(s)', r_openQueue: 'Open queue',
  r_svcConfig: 'service(s) to configure', r_review: 'Review',
  r_bannedUsers: 'banned user(s)', r_seeUsers: 'View users',

  u_search: 'Search by email…', u_admin: 'admin',
  u_active: 'active', u_banned: 'banned',
  u_unban: 'Unban', u_makeAdmin: 'Make admin', u_removeAdmin: 'Remove admin',

  t_you: ' (you)', t_lastActivity: 'Last activity: ', t_noActivity: 'No activity',
  t_perms: 'Permissions', t_close: 'Close', t_remove: 'Remove',
  t_permsByArea: 'Permissions by area', t_permsHint: '· the role sets defaults; fine-tune them here',
  t_invite: 'Invite member (must be registered in the app)',
  t_invitePh: 'email@example.com', t_inviteBtn: '+ Invite',
  t_activity: 'Activity log', t_member: 'Member:', t_all: 'All',
  t_noActivityTopic: 'No activity in this topic.',
  lvl_none: 'No access', lvl_view: 'View', lvl_manage: 'Manage',
  role_owner: 'Owner', role_admin: 'Admin', role_support: 'Support', role_marketing: 'Marketing', role_custom: 'Custom',
  lt_all: 'All', lt_equipo: 'Team', lt_soporte: 'Support', lt_baseia: 'AI Base', lt_usuarios: 'Users', lt_planes: 'Plans',

  s_open: 'Open', s_inprogress: 'In progress', s_resolved: 'Resolved', s_all: 'All',
  s_search: 'Search by email or subject…', s_empty: 'No conversations in this view.',
  s_pickOne: 'Pick a conversation on the left to see it here.',
  s_unassigned: 'unassigned', s_assignedTo: 'assigned to ',
  s_visitor: 'Visitor', s_inConvo: 'In the conversation: ',
  s_reply: 'Reply', s_note: 'Internal note', s_notePh: 'Note only the team can see…',
  s_replyPh: 'Reply for the trader (sent by email)…',
  s_sendReply: 'Send reply', s_saveNote: 'Save note', s_aiDraft: 'AI draft',
  s_take: 'Take', s_resolve: 'Resolve', s_reopen: 'Reopen',
  s_invitePh: 'Invite teammate (their team email)', s_inviteBtn: 'Invite',
  st_open: 'Open', st_inprogress: 'In progress', st_resolved: 'Resolved',
  sender_trader: 'Trader', sender_note: '🔒 Internal note', sender_support: 'Support',
  ch_ticket: 'Ticket', ch_chat: 'Chat', ch_lead: 'Lead', ch_email: 'Email',
  cat_general: 'General', cat_conexion: 'Connection', cat_instalacion: 'Install', cat_guardian: 'Onyx Guardian', cat_facturacion: 'Billing',

  d_refresh: '↻ Refresh', d_loading: 'Loading diagnostics…',
  d_quickTests: '⚡ Quick tests', d_testAI: '🤖 Test AI', d_testEmail: '📧 Send test email', d_testTG: '✈️ Test Telegram',
  d_db: '🗄️ Database (did you run the SQL?)', d_applied: '✓ applied', d_missing: '✗ not run',
  d_missingMsg: 'You still need to run in Supabase → SQL Editor: ',
  d_recentErrors: '🚨 Recent errors', d_noErrors: 'No errors logged. 🎉',
  d_commonErrors: '📖 Common errors explained',

  a_yourRole: 'Your role', a_rolesTitle: 'How roles work',
  a_rolesBody: 'The Owner controls plans, users and team. Admins manage users and plans. Support only views and helps.',
  a_rolesEnv: 'Emails in ADMIN_EMAILS on Vercel always come in as Owner. You can add more admins from the Team tab.',
};

const AT: Record<string, Dict> = { es: ES, en: EN };

export function useT(): Dict {
  const { lang } = useLang();
  return AT[lang] || ES;
}
