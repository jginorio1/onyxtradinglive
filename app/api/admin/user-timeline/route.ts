import { NextResponse } from 'next/server';
import { getAdmin, requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { userPresence } from '@/lib/monitor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Expediente unificado de un usuario: junta TODO lo que ya se registra en tablas
// separadas (auth, perfil, onboarding, dispositivos, correos, conexión de bróker,
// plan y pagos, soporte, consumo de IA, acciones de admin) en UNA línea de tiempo
// por tema y urgencia, con fecha/hora. Lectura en vivo: no duplica datos.
type Ev = { ts: string | null; theme: string; urgent?: boolean; icon: string; title: string; detail?: string };

export async function GET(req: Request) {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const p = await requirePerm('usuarios', 'view'); if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });

  const events: Ev[] = [];
  const S = (v: any, n = 80) => (v == null ? '' : String(v)).slice(0, n);

  // ---- Perfil (onboarding, plan, fuente, última actividad) ----
  let prof: any = null;
  try { const r = await supabaseAdmin.from('profiles').select('*').eq('id', id).maybeSingle(); prof = r.data; } catch {}
  const email = prof?.email || '';

  // Mapa id→nombre visible de los planes, para mostrar "Onyx Builder" en vez de "trader".
  const planName: Record<string, string> = {};
  try { const { data } = await supabaseAdmin.from('plans').select('id,name'); (data || []).forEach((p: any) => { planName[p.id] = p.name || p.id; }); } catch {}
  const pName = (idv: any) => idv ? (planName[idv] || String(idv)) : '—';

  // ---- Auth (registro, confirmación, último login, baneo) ----
  let au: any = null;
  try { const r = await (supabaseAdmin.auth as any).admin.getUserById(id); au = r?.data?.user || null; } catch {}
  const confirmed = au?.email_confirmed_at || au?.confirmed_at || null;
  if (au?.created_at) events.push({ ts: au.created_at, theme: 'cuenta', icon: 'user-plus', title: 'Se registró', detail: prof?.signup_source ? `Fuente: ${S(prof.signup_source, 30)}` : undefined });
  if (confirmed) events.push({ ts: confirmed, theme: 'cuenta', icon: 'mail-check', title: 'Confirmó su correo' });
  else if (au) {
    const ageDays = au.created_at ? Math.floor((Date.now() - new Date(au.created_at).getTime()) / 864e5) : 0;
    events.push({ ts: au.created_at || null, theme: 'cuenta', urgent: true, icon: 'alert-triangle', title: 'Aún NO confirma su correo', detail: `${ageDays} día(s) · se borra a los 7 si no confirma` });
  }
  if (au?.last_sign_in_at) events.push({ ts: au.last_sign_in_at, theme: 'cuenta', icon: 'login', title: 'Último inicio de sesión' });
  if (au?.banned_until && new Date(au.banned_until) > new Date()) events.push({ ts: au.banned_until, theme: 'cuenta', urgent: true, icon: 'ban', title: 'Cuenta bloqueada (ban)' });

  // Onboarding + lo que llenó
  if (prof?.onboarded_at) {
    const bits = [prof.experience, prof.trade_style, prof.platform, prof.country, prof.goal].filter(Boolean).map((x: any) => S(x, 24)).join(' · ');
    events.push({ ts: prof.onboarded_at, theme: 'cuenta', icon: 'forms', title: 'Completó el onboarding', detail: bits || undefined });
  }

  // ---- Dispositivos / plataformas (cada token = un dispositivo donde abrió la app) ----
  const devices: { platform: string; ts: string | null }[] = [];
  try { const { data } = await supabaseAdmin.from('native_push_tokens').select('platform,updated_at,created_at').eq('user_id', id); (data || []).forEach((d: any) => devices.push({ platform: (d.platform || 'app'), ts: d.created_at || d.updated_at || null })); } catch {}
  try { const { data } = await supabaseAdmin.from('push_subscriptions').select('created_at').eq('user_id', id); (data || []).forEach((d: any) => devices.push({ platform: 'web/pc', ts: d.created_at || null })); } catch {}
  const platSet: Record<string, string | null> = {};
  for (const d of devices) { const k = d.platform.toLowerCase(); if (!(k in platSet) || (d.ts && (!platSet[k] || d.ts < (platSet[k] as string)))) platSet[k] = d.ts; }
  Object.keys(platSet).forEach((k) => events.push({ ts: platSet[k], theme: 'dispositivo', icon: 'device-mobile', title: `Abrió la app en: ${k}`, detail: 'primer registro del dispositivo' }));

  // ---- Conexión de bróker (plataforma) ----
  try {
    const { data } = await supabaseAdmin.from('trading_accounts').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(20);
    (data || []).forEach((a: any) => {
      const plat = a.platform || a.broker || 'bróker';
      const acc = a.login || a.account || a.number || a.account_number || a.nickname || a.name || '';
      events.push({ ts: a.created_at || null, theme: 'conexion', icon: 'plug-connected', title: 'Conectó una cuenta de bróker', detail: `${S(plat, 24)}${acc ? ' · ' + S(acc, 24) : ''}` });
    });
  } catch {}

  // ---- Correos que le envió el sistema ----
  if (email) {
    const KIND: Record<string, string> = {
      admin: 'Aviso del equipo', billing: 'Facturación', onboarding: 'Bienvenida', campaign: 'Campaña',
      campaigns: 'Campaña', training_cert: 'Certificado de capacitación', password_reset: 'Restablecer contraseña',
      ticket: 'Soporte', support: 'Soporte', scholarship: 'Beca (academia)', academy: 'Academia',
      botlab_promo: 'Promo Bot Lab', botlab: 'Bot Lab', confirm: 'Confirmación de registro', signup: 'Confirmación de registro',
    };
    const ST: Record<string, string> = { sent: 'enviado', failed: 'falló', queued: 'en cola' };
    try {
      const { data } = await supabaseAdmin.from('email_log').select('subject,kind,status,created_at').eq('to_email', email).order('created_at', { ascending: false }).limit(60);
      (data || []).forEach((m: any) => {
        const k = m.kind ? (KIND[m.kind] || m.kind.replace(/_/g, ' ')) : '';
        const st = m.status ? (ST[m.status] || m.status) : '';
        events.push({ ts: m.created_at || null, theme: 'correo', icon: 'mail', title: `Correo: ${S(m.subject, 60)}`, detail: [k, st].filter(Boolean).join(' · ') || undefined });
      });
    } catch {}
  }

  // ---- Tickets de soporte ----
  const TST: Record<string, string> = { open: 'abierto', closed: 'cerrado', pending: 'pendiente', resolved: 'resuelto', answered: 'respondido', new: 'nuevo' };
  try {
    const { data } = await supabaseAdmin.from('support_tickets').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(30);
    (data || []).forEach((t: any) => events.push({ ts: t.created_at || null, theme: 'soporte', urgent: (t.priority === 'high' || t.priority === 'urgent'), icon: 'lifebuoy', title: `Ticket: ${S(t.subject || t.title || 'consulta', 60)}`, detail: t.status ? (TST[t.status] || S(t.status, 24)) : undefined }));
  } catch {}

  // ---- Acciones de admin sobre el usuario ----
  try {
    const { data } = await supabaseAdmin.from('admin_log').select('admin_email,action,meta,created_at').eq('target', id).order('created_at', { ascending: false }).limit(60);
    // Etiquetas de las acciones REALES que se registran sobre un usuario
    // (ver app/api/admin/users, /credit, /user-activity, /security).
    const ADM: Record<string, string> = {
      plan: 'Le cambiaron el plan (manual)', self_plan: 'Cambió su propio plan',
      ban: 'Bloquearon la cuenta', unban: 'Desbloquearon la cuenta',
      admin: 'Cambiaron su rol de admin', name: 'Le cambiaron el nombre',
      delete_user: 'Eliminaron la cuenta', email_user: 'Le enviaron un correo',
      user_credit: 'Le aplicaron crédito', resend_confirm: 'Le reenviaron el correo de confirmación',
      comp_grant: 'Le dieron días de cortesía', comp_revoke: 'Le quitaron la cortesía',
      pin_fail: 'Falló el PIN de seguridad', pin_lockout: 'PIN bloqueado por intentos',
      '2fa_backup_generate': 'Generó códigos de respaldo 2FA', '2fa_backup_used': 'Usó un código de respaldo 2FA',
    };
    // Convierte un código crudo ("algo_raro") en texto legible como último recurso.
    const pretty = (a: string) => a ? (a.charAt(0).toUpperCase() + a.slice(1)).replace(/_/g, ' ') : 'Acción';
    (data || []).forEach((l: any) => {
      const m: any = l.meta || {};
      // Detalle: lo que cambió, según el tipo de acción (sin inventar).
      let detail = '';
      if (l.action === 'plan' || l.action === 'self_plan') {
        if (m.from || m.to) detail = `${pName(m.from)} → ${pName(m.to)}`;
      } else if (l.action === 'comp_grant') {
        const until = m.until ? `hasta ${String(m.until).slice(0, 10)}` : '';
        detail = [m.days ? `${m.days} días` : '', m.plan ? `plan ${pName(m.plan)}` : '', until].filter(Boolean).join(' · ');
      } else if (l.action === 'user_credit' && m.amount != null) {
        detail = `$${m.amount}${m.note ? ' · ' + S(m.note, 40) : ''}`;
      } else if (l.action === 'admin') {
        detail = m.value ? 'ahora es admin' : 'ya no es admin';
      } else if (l.action === 'name' && m.name) {
        detail = S(m.name, 40);
      } else if (l.action === 'email_user' && m.subject) {
        detail = S(m.subject, 50);
      } else if (m.note) {
        detail = S(m.note, 50);
      }
      const by = l.admin_email ? `por ${S(l.admin_email, 40)}` : '';
      events.push({ ts: l.created_at || null, theme: 'admin', icon: 'shield', title: (ADM[l.action] || pretty(l.action)), detail: [detail, by].filter(Boolean).join(' · ') || undefined });
    });
  } catch {}

  // ---- Consumo de IA del usuario, DESGLOSADO POR MÓDULO (requiere ai_usage.user_id) ----
  // feature = de dónde salió (coach, soporte, análisis, academia, bot lab…).
  let aiCents = 0, aiTokens = 0, aiCalls = 0;
  const aiByFeat: Record<string, { calls: number; cents: number }> = {};
  try {
    const { data } = await supabaseAdmin.from('ai_usage').select('feature,input_tokens,output_tokens,cost_cents,created_at').eq('user_id', id);
    (data || []).forEach((u: any) => {
      const f = u.feature || 'otros';
      aiCents += Number(u.cost_cents || 0); aiTokens += Number(u.input_tokens || 0) + Number(u.output_tokens || 0); aiCalls++;
      (aiByFeat[f] ||= { calls: 0, cents: 0 }); aiByFeat[f].calls++; aiByFeat[f].cents += Number(u.cost_cents || 0);
    });
  } catch { /* si la columna user_id no existe aún, queda en 0 */ }
  // Nombres legibles de cada módulo para el panel.
  const FEAT_LABEL: Record<string, string> = {
    coach: 'Coach', soporte: 'Soporte', academia: 'Academia', academy: 'Academia', botlab: 'Bot Lab',
    equipo: 'Equipo', correos: 'Correos', campanas: 'Campañas', embajadores: 'Embajadores',
    ventas: 'Ventas', carreras: 'Carreras', seo: 'SEO', blog: 'Blog', moderacion: 'Moderación',
    training: 'Capacitación', socios: 'Socios', resenas: 'Reseñas', guide: 'Guías', factory: 'Fábrica', otros: 'Otros',
  };
  const aiFeatures = Object.entries(aiByFeat)
    .map(([feature, v]) => ({ feature, label: FEAT_LABEL[feature] || feature, calls: v.calls, cents: v.cents }))
    .sort((a, b) => b.calls - a.calls);
  if (aiCalls > 0) {
    const topFeat = aiFeatures.slice(0, 3).map((f) => `${f.label} ×${f.calls}`).join(' · ');
    events.push({ ts: null, theme: 'ia', icon: 'robot', title: `Usó Onyx AI · ${aiCalls} consultas`, detail: `${(aiTokens / 1000).toFixed(0)}k tokens · $${(aiCents / 100).toFixed(2)}${topFeat ? ' · ' + topFeat : ''}` });
  }

  // Tope mensual del usuario (límite por plan + paquete extra) para mostrarlo.
  let allowance: any = null;
  try { const { aiAllowance } = await import('@/lib/aiLimits'); allowance = await aiAllowance(id); } catch {}

  // Ordena por fecha (los sin fecha, al final).
  events.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));

  // Presencia: ¿en línea?, ¿en qué sección?, IP/ciudad (ver monitor.ts).
  const presence = await userPresence(id);

  const summary = {
    email, plan: prof?.plan ? pName(prof.plan) : null,
    confirmed: !!confirmed,
    onboarded: !!prof?.onboarded_at,
    lastSeen: presence.lastSeen || prof?.last_seen_at || au?.last_sign_in_at || null,
    emails: events.filter((e) => e.theme === 'correo').length,
    tickets: events.filter((e) => e.theme === 'soporte').length,
    devices: Object.keys(platSet),
    accounts: events.filter((e) => e.theme === 'conexion').length,
    aiCents, aiTokens, aiCalls, aiFeatures, aiAllowance: allowance,
    presence,
  };

  return NextResponse.json({ summary, events });
}
