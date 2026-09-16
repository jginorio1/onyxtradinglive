// ============================================================
// Onyx Command Center — Fase 2: motor de ALERTAS.
// Un cron corre esto cada ~15 min: revisa condiciones y, si algo está mal, avisa
// por Telegram (al chat del dueño y/o a los admins con Telegram vinculado) y deja
// el aviso en el propio Command Center (como evento 'alert'). Con enfriamiento
// para no spamear el mismo problema una y otra vez.
// ============================================================
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSetting, saveSetting } from '@/lib/settings';
import { sendMessage, telegramEnabled } from '@/lib/telegram';
import { logActivity } from '@/lib/monitor';

export type MonitorAlerts = {
  enabled: boolean;
  chat: string;              // chat id de Telegram del dueño (opcional)
  toAdmins: boolean;         // también a los admins con Telegram vinculado
  blogStuckHours: number;    // avisar si el blog no publica en > N h
  empIdleHours: number;      // empleado sin actividad > N h (en el día)
  errorSpike: number;        // errores en la última hora > N
  activityDrop: boolean;     // avisar si la actividad general cae a 0 de golpe
  cooldownH: number;         // no repetir la MISMA alerta antes de N horas
  _sent?: Record<string, string>;   // interno: última vez enviada por clave (ISO)
};

export const ALERTS_DEFAULT: MonitorAlerts = {
  enabled: true, chat: '', toAdmins: true,
  blogStuckHours: 36, empIdleHours: 5, errorSpike: 15, activityDrop: true,
  cooldownH: 3, _sent: {},
};

const H = 3600 * 1000;

export async function getAlertCfg(): Promise<MonitorAlerts> {
  const s = await getSetting<MonitorAlerts>('monitor_alerts', ALERTS_DEFAULT);
  return { ...ALERTS_DEFAULT, ...(s || {}) };
}
export async function saveAlertCfg(cfg: Partial<MonitorAlerts>) {
  const cur = await getAlertCfg();
  await saveSetting('monitor_alerts', { ...cur, ...cfg });
}

// Destinatarios: el chat fijo + (opcional) los admins con Telegram vinculado.
async function recipients(cfg: MonitorAlerts): Promise<string[]> {
  const out = new Set<string>();
  if (cfg.chat) out.add(String(cfg.chat).trim());
  if (cfg.toAdmins) {
    try {
      const { data } = await supabaseAdmin.from('profiles').select('telegram_chat_id').eq('is_admin', true).not('telegram_chat_id', 'is', null);
      (data || []).forEach((r: any) => { if (r.telegram_chat_id) out.add(String(r.telegram_chat_id)); });
    } catch {}
  }
  return [...out];
}

// Envía una alerta (con enfriamiento por clave). Devuelve true si se envió.
async function fire(cfg: MonitorAlerts, key: string, text: string): Promise<boolean> {
  const last = cfg._sent?.[key];
  if (last && Date.now() - new Date(last).getTime() < cfg.cooldownH * H) return false;   // en enfriamiento
  // Deja rastro en el Command Center pase lo que pase.
  await logActivity({ actor_role: 'system', actor_name: 'Command Center', kind: 'alert', label: text.replace(/\*/g, '').slice(0, 180) });
  if (telegramEnabled()) {
    const to = await recipients(cfg);
    for (const chat of to) { try { await sendMessage(chat, '🛰️ *Onyx Command Center*\n' + text); } catch {} }
  }
  cfg._sent = { ...(cfg._sent || {}), [key]: new Date().toISOString() };
  return true;
}

// Corre todas las comprobaciones. Idempotente y silenciosa ante fallos.
export async function runAlerts(): Promise<{ checked: number; fired: string[] }> {
  const cfg = await getAlertCfg();
  const fired: string[] = [];
  if (!cfg.enabled) return { checked: 0, fired };

  // 1) Blog atascado: última publicación hace demasiado.
  try {
    const { data } = await supabaseAdmin.from('blog_posts').select('published_at').eq('status', 'published').order('published_at', { ascending: false }).limit(1);
    const last = (data || [])[0]?.published_at;
    const hrs = last ? (Date.now() - new Date(last).getTime()) / H : 999;
    if (hrs > cfg.blogStuckHours) { if (await fire(cfg, 'blog_stuck', `📝 El *blog automático* no publica desde hace ${Math.round(hrs)} h. Revisa el autopiloto o el crédito de la IA.`)) fired.push('blog_stuck'); }
  } catch {}

  // 2) Pico de errores en la última hora.
  try {
    const { count } = await supabaseAdmin.from('app_errors').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - H).toISOString());
    if ((count || 0) > cfg.errorSpike) { if (await fire(cfg, 'error_spike', `🐞 *${count} errores* en la última hora (umbral ${cfg.errorSpike}). Revisa Diagnóstico.`)) fired.push('error_spike'); }
  } catch {}

  // 3) Caída de actividad: 0 eventos en la última hora habiendo tráfico antes.
  if (cfg.activityDrop) {
    try {
      const now = Date.now();
      const [{ count: h0 }, { count: h1 }] = await Promise.all([
        supabaseAdmin.from('activity_events').select('id', { count: 'exact', head: true }).gte('created_at', new Date(now - H).toISOString()),
        supabaseAdmin.from('activity_events').select('id', { count: 'exact', head: true }).gte('created_at', new Date(now - 2 * H).toISOString()).lt('created_at', new Date(now - H).toISOString()),
      ]);
      if ((h0 || 0) === 0 && (h1 || 0) >= 15) { if (await fire(cfg, 'activity_drop', `📉 *Sin actividad* en la última hora (antes había ${h1}). ¿Se cayó el sitio?`)) fired.push('activity_drop'); }
    } catch {}
  }

  // 4) Empleados inactivos: del equipo, quien no registra actividad en el día.
  try {
    const { data: emps } = await supabaseAdmin.from('profiles').select('email,full_name,is_admin,role').or('is_admin.eq.true,role.in.(support,marketing,admin)').limit(200);
    const since = new Date(Date.now() - cfg.empIdleHours * H).toISOString();
    for (const e of (emps || []) as any[]) {
      if (!e.email) continue;
      const { count } = await supabaseAdmin.from('activity_events').select('id', { count: 'exact', head: true }).eq('actor_email', String(e.email).toLowerCase()).gte('created_at', since);
      if ((count || 0) === 0) { if (await fire(cfg, 'emp_idle:' + e.email, `😴 *${e.full_name || e.email}* lleva +${cfg.empIdleHours} h sin actividad.`)) fired.push('emp_idle:' + e.email); }
    }
  } catch {}

  // Persistir los "_sent" actualizados (enfriamientos).
  try { await saveSetting('monitor_alerts', cfg); } catch {}
  return { checked: 4, fired };
}
