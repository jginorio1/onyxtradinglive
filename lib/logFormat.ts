// ============================================================
// Formateador de logs de auditoría: convierte cada (action, target, meta)
// en una frase EXACTA en el idioma del usuario, con categoría (para color) e
// icono. Se usa en el drawer del usuario y en el registro global de admin.
// La BD ya guarda el meta; aquí solo lo mostramos legible.
// ============================================================

export type LogCat = 'money' | 'plan' | 'danger' | 'security' | 'content' | 'team' | 'other';
export type LogEntry = { admin_email?: string; action: string; target?: any; meta?: any; created_at?: string };

// Color e icono por categoría (usa variables CSS del tema).
export const CAT_STYLE: Record<LogCat, { color: string; bg: string; icon: string; es: string; en: string }> = {
  money:    { color: 'var(--green)',       bg: 'rgba(52,226,160,.12)',  icon: '💵', es: 'Dinero',     en: 'Money' },
  plan:     { color: 'var(--soft-brand,#7c8cff)', bg: 'rgba(124,140,255,.12)', icon: '📦', es: 'Planes', en: 'Plans' },
  danger:   { color: 'var(--red)',         bg: 'rgba(226,75,75,.12)',   icon: '🗑️', es: 'Peligro',   en: 'Danger' },
  security: { color: 'var(--amber)',       bg: 'rgba(240,160,20,.12)',  icon: '🔒', es: 'Seguridad', en: 'Security' },
  content:  { color: 'var(--brand2,#a78bfa)', bg: 'rgba(167,139,250,.12)', icon: '📝', es: 'Contenido', en: 'Content' },
  team:     { color: 'var(--soft-green,#34e2a0)', bg: 'rgba(52,226,160,.10)', icon: '👥', es: 'Equipo', en: 'Team' },
  other:    { color: 'var(--mut)',         bg: 'var(--bg2)',            icon: '•',  es: 'Otros',     en: 'Other' },
};

const money = (n: any) => `$${(Math.round(Number(n) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const short = (s: any, n = 40) => (s == null ? '' : String(s).length > n ? String(s).slice(0, n) + '…' : String(s));

// Devuelve { text, cat } para una entrada. es = idioma español.
export function describeLog(e: LogEntry, lang: 'es' | 'en' = 'es'): { text: string; cat: LogCat } {
  const es = lang !== 'en';
  const a = e.action || '';
  const m = e.meta || {};
  const tgt = e.target != null ? String(e.target) : '';
  const L = (s: string, en: string) => (es ? s : en);
  // Sufijo con la nota (si la acción la trae). El texto final la muestra siempre.
  const nt = (t: string) => m.note ? `${t} · ${L('Nota', 'Note')}: “${short(m.note, 60)}”` : t;
  const R = (text: string, cat: LogCat): { text: string; cat: LogCat } => ({ text: nt(text), cat });

  // dinero
  if (a === 'user_credit') {
    const amt = Number(m.amount) || 0;
    const verb = amt >= 0 ? L('Aplicó', 'Applied') : L('Quitó', 'Removed');
    const note = m.note ? ` · ${L('Nota', 'Note')}: “${short(m.note, 60)}”` : '';
    return { text: `${verb} ${money(Math.abs(amt))} ${L('de crédito', 'credit')}${note}`, cat: 'money' };
  }
  if (a === 'amb_payout_paid') {
    const ref = m.transfer_id || m.tx_ref;
    return R(`${L('Pagó a un embajador por', 'Paid an ambassador via')} ${m.via || 'stripe'}${ref ? ` (${short(ref, 24)})` : ''}`, 'money');
  }
  if (a === 'finanzas_add') return { text: `${L('Añadió gasto', 'Added expense')} “${short(m.name)}” · ${money(m.amount)}`, cat: 'money' };
  if (a === 'finanzas_update') return { text: L('Editó un gasto del negocio', 'Edited a business expense'), cat: 'money' };
  if (a === 'finanzas_delete') return R(L('Borró un gasto del negocio', 'Deleted a business expense'), 'money');
  if (a === 'finanzas_cash') return { text: `${L('Fijó la caja en', 'Set cash to')} ${money(tgt)}`, cat: 'money' };
  if (a === 'academy_fee_default') return { text: `${L('Comisión global de academia', 'Global academy fee')} → ${tgt}%`, cat: 'money' };
  if (a === 'academy_fee_plan' || a === 'academy_fee_mentor') return { text: `${L('Cambió comisión de academia a', 'Changed academy fee to')} ${m.fee_pct}%`, cat: 'money' };

  // planes
  if (a === 'self_plan' || a === 'plan' || a === 'change_plan') {
    if (m.from && m.to) {
      const dir = m.dir === 'up' ? L('subida', 'upgrade') : m.dir === 'down' ? L('bajada', 'downgrade') : '';
      return { text: `${L('Cambió de plan', 'Changed plan')} ${m.from} → ${m.to}${dir ? ` (${dir})` : ''}`, cat: 'plan' };
    }
    return { text: `${L('Cambió el plan a', 'Changed plan to')} ${m.plan || m.value || tgt}`, cat: 'plan' };
  }
  if (a === 'edit_plan') return { text: `${L('Editó el plan', 'Edited plan')} ${tgt}`, cat: 'plan' };
  if (a === 'create_plan') return { text: `${L('Creó el plan', 'Created plan')} ${tgt}`, cat: 'plan' };
  if (a === 'delete_plan') return R(`${L('Borró el plan', 'Deleted plan')} ${tgt}`, 'plan');

  // peligro
  if (a === 'delete_user') return R(`${L('Eliminó la cuenta', 'Deleted account')} ${m.email || tgt} ${L('y todos sus datos', 'and all its data')}`, 'danger');
  if (a === 'ban') return R(`${L('Bloqueó la cuenta', 'Banned account')} ${m.email || tgt}`, 'danger');
  if (a === 'unban') return R(`${L('Desbloqueó la cuenta', 'Unbanned account')} ${m.email || tgt}`, 'security');

  // seguridad
  if (a === 'admin') return { text: m.value ? `${L('Hizo admin a', 'Made admin')} ${m.email || tgt}` : `${L('Quitó admin a', 'Removed admin from')} ${m.email || tgt}`, cat: 'security' };
  if (a === 'reset_password') return { text: `${L('Envió recuperación de contraseña a', 'Sent password reset to')} ${tgt}`, cat: 'security' };
  if (a === 'pin_fail') return { text: L('PIN de admin incorrecto', 'Wrong admin PIN'), cat: 'security' };
  if (a === 'pin_lockout') return { text: L('Bloqueó el panel por PIN fallido', 'Locked panel after failed PIN'), cat: 'security' };
  if (a === '2fa_backup_generate') return { text: L('Generó códigos de respaldo 2FA', 'Generated 2FA backup codes'), cat: 'security' };
  if (a === '2fa_backup_used') return { text: `${L('Usó un código de respaldo 2FA', 'Used a 2FA backup code')} (${m.left} ${L('restantes', 'left')})`, cat: 'security' };

  // contenido
  if (a === 'blog_save') return { text: `${L('Guardó un artículo del blog', 'Saved a blog post')}${m.status ? ` (${m.status})` : ''}`, cat: 'content' };
  if (a === 'blog_delete') return { text: L('Borró un artículo del blog', 'Deleted a blog post'), cat: 'content' };
  if (a === 'kb_add') return { text: `${L('Añadió a la Base IA', 'Added to AI knowledge')}: “${short(tgt)}”`, cat: 'content' };
  if (a === 'kb_edit') return { text: L('Editó una entrada de la Base IA', 'Edited an AI knowledge entry'), cat: 'content' };
  if (a === 'kb_delete') return R(`${L('Borró de la Base IA', 'Deleted from AI knowledge')}${tgt ? `: “${short(tgt)}”` : ''}`, 'content');
  if (a === 'kb_import_guide') return { text: `${L('Importó la guía a la Base IA', 'Imported guide to AI knowledge')} (+${m.added || 0}/~${m.updated || 0})`, cat: 'content' };
  if (a === 'catalog_save') return { text: `${L('Guardó el catálogo', 'Saved catalog')} ${tgt} (${m.count})`, cat: 'content' };
  if (a === 'catalog_reset') return R(`${L('Restauró el catálogo', 'Reset catalog')} ${tgt}`, 'content');
  if (a === 'firms_save') return { text: `${L('Guardó plantillas de prop firms', 'Saved prop-firm templates')} (${m.count})`, cat: 'content' };
  if (a === 'firms_reset') return { text: L('Restauró las prop firms', 'Reset prop firms'), cat: 'content' };
  if (a === 'campaign_create' || a === 'campaign_schedule') return { text: L('Creó/programó una campaña', 'Created/scheduled a campaign'), cat: 'content' };
  if (a === 'campaign_send') return R(`${L('Envió una campaña a', 'Sent a campaign to')} ${m.sent || 0} ${L('traders', 'traders')}${m.subject ? ` · “${short(m.subject)}”` : ''}`, 'content');
  if (a === 'campaign_update') return { text: L('Editó una campaña', 'Edited a campaign'), cat: 'content' };
  if (a === 'campaign_delete') return R(`${L('Borró una campaña', 'Deleted a campaign')}${tgt ? `: “${short(tgt)}”` : ''}`, 'content');

  // equipo / embajadores / soporte
  if (a === 'team_add') return { text: `${L('Añadió al equipo a', 'Added to team')} ${tgt}${m.role ? ` (${m.role})` : ''}`, cat: 'team' };
  if (a === 'team_remove') return { text: `${L('Quitó del equipo a', 'Removed from team')} ${tgt}`, cat: 'team' };
  if (a === 'team_update') return { text: `${L('Cambió permisos de', 'Changed permissions of')} ${tgt}`, cat: 'team' };
  if (a === 'team_chat' || a === 'team_chat_add') return { text: L('Actividad en el chat del equipo', 'Team chat activity'), cat: 'team' };
  if (a === 'amb_approve') return { text: L('Aprobó a un embajador', 'Approved an ambassador'), cat: 'team' };
  if (a === 'amb_status') return { text: `${L('Cambió estado de embajador a', 'Set ambassador status to')} ${m.status}`, cat: 'team' };
  if (a === 'amb_rate') return { text: `${L('Cambió la comisión del embajador a', 'Set ambassador rate to')} ${m.rate ?? 'auto'}%`, cat: 'team' };
  if (a === 'amb_settings' || a === 'member_referral_settings') return { text: L('Cambió ajustes de referidos', 'Changed referral settings'), cat: 'team' };
  if (a === 'ambassador_prospect_add') return { text: L('Añadió un prospecto de embajador', 'Added an ambassador prospect'), cat: 'team' };
  if (a === 'ambassador_invite_sent') return { text: `${L('Invitó a embajador', 'Invited ambassador')} ${short(tgt, 30)}`, cat: 'team' };
  if (a === 'support_reply') return { text: `${L('Respondió un ticket', 'Replied to a ticket')}${m.emailed ? ` (${L('por correo', 'emailed')})` : ''}`, cat: 'team' };
  if (a === 'support_note') return { text: L('Añadió una nota interna a un ticket', 'Added an internal ticket note'), cat: 'team' };
  if (a === 'support_invite') return { text: L('Invitó a un compañero a un ticket', 'Invited a teammate to a ticket'), cat: 'team' };
  if (a === 'email_user') return { text: `${L('Envió un correo:', 'Sent an email:')} “${short(m.subject)}”`, cat: 'team' };
  if (a === 'canned_create') return { text: `${L('Creó una respuesta guardada', 'Created a canned reply')}${m.title ? `: “${short(m.title)}”` : ''}`, cat: 'content' };
  if (a === 'canned_delete') return { text: L('Borró una respuesta guardada', 'Deleted a canned reply'), cat: 'content' };
  if (a === 'ai_prompt_save' || a === 'support_ai_toggle') return { text: L('Cambió los ajustes de Onyx AI', 'Changed Onyx AI settings'), cat: 'content' };

  // otros
  if (a === 'clean_signups') return { text: `${L('Limpió registros incompletos', 'Cleaned incomplete signups')} (${tgt})`, cat: 'other' };
  if (a && a.startsWith('settings_')) return { text: `${L('Cambió un ajuste:', 'Changed a setting:')} ${a.replace('settings_', '')}`, cat: 'other' };
  if (a === 'academy_perks') return { text: L('Cambió los perks de la academia', 'Changed academy perks'), cat: 'other' };

  // fallback legible
  return { text: `${a}${tgt ? ` · ${short(tgt, 30)}` : ''}`, cat: 'other' };
}
