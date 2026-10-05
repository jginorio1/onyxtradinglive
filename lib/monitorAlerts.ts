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
import { sendEmail } from '@/lib/mail';
import { mailRoutes } from '@/lib/settings';

export type MonitorAlerts = {
  enabled: boolean;
  chat: string;              // chat id de Telegram del dueño (opcional)
  toAdmins: boolean;         // también a los admins con Telegram vinculado
  email: boolean;            // también por CORREO a alerts@ + ADMIN_EMAILS (ON por defecto)
  blogStuckHours: number;    // avisar si el blog no publica en > N h
  empIdleHours: number;      // empleado sin actividad > N h (en el día)
  errorSpike: number;        // errores en la última hora > N
  activityDrop: boolean;     // avisar si la actividad general cae a 0 de golpe
  anomaly: boolean;          // detección de anomalías (aprende lo "normal" por hora)
  backupStaleDays: number;   // avisar si la última copia tiene > N días (0 = no revisar)
  cooldownH: number;         // no repetir la MISMA alerta antes de N horas
  _sent?: Record<string, string>;   // interno: última vez enviada por clave (ISO)
};

export const ALERTS_DEFAULT: MonitorAlerts = {
  enabled: true, chat: '', toAdmins: true, email: true,
  blogStuckHours: 36, empIdleHours: 5, errorSpike: 15, activityDrop: true, anomaly: true,
  backupStaleDays: 2, cooldownH: 3, _sent: {},
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

// Destinatarios de CORREO para avisos de dueño: el buzón de alertas (alerts@ de
// Direcciones de correo) + ADMIN_EMAILS del entorno, sin duplicar.
async function emailAdmins(subject: string, body: string): Promise<void> {
  const set = new Set<string>();
  try { const r = await mailRoutes(); if (r?.alerts) set.add(String(r.alerts).toLowerCase()); } catch {}
  (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean).forEach((e) => set.add(e.toLowerCase()));
  for (const e of set) { try { await sendEmail(e, subject, body + '\n\nRevisa Admin → Diagnóstico / Command Center.', { kind: 'admin' }); } catch {} }
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
  // CORREO al buzón de alertas (alerts@) + ADMIN_EMAILS. Así los avisos importantes
  // (backup viejo, sitio caído, pico de errores…) también llegan por email, no solo Telegram.
  if (cfg.email !== false) { try { await emailAdmins('🛰️ Onyx Command Center · alerta', text.replace(/\*/g, '')); } catch {} }
  cfg._sent = { ...(cfg._sent || {}), [key]: new Date().toISOString() };
  return true;
}

// Corre todas las comprobaciones. Idempotente y silenciosa ante fallos.
export async function runAlerts(): Promise<{ checked: number; fired: string[] }> {
  const cfg = await getAlertCfg();
  const fired: string[] = [];
  if (!cfg.enabled) return { checked: 0, fired };

  // 1) Blog atascado: última publicación hace demasiado.
  // IMPORTANTE: excluimos published_at NULL. Postgres ordena los NULL PRIMERO en
  // "DESC", así que si un post publicado quedó sin published_at, la consulta antigua
  // leía ese NULL como "el más reciente", creía que no había fecha y disparaba 999 h
  // (falsa alarma: "el blog no publica" cuando SÍ había publicado). Con .not(is null)
  // y, de respaldo, la fecha real más reciente entre published_at y created_at.
  try {
    const { data } = await supabaseAdmin.from('blog_posts')
      .select('published_at, created_at')
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(1);
    let last = (data || [])[0]?.published_at || null;
    // Respaldo: si por lo que sea no vino published_at, usa el created_at más reciente
    // de un post publicado (así nunca dispara por un dato faltante, solo por atasco real).
    if (!last) {
      const { data: d2 } = await supabaseAdmin.from('blog_posts')
        .select('created_at').eq('status', 'published')
        .order('created_at', { ascending: false }).limit(1);
      last = (d2 || [])[0]?.created_at || null;
    }
    // Si de plano no hay ningún post publicado, NO avisamos (no es un "atasco").
    if (last) {
      const hrs = (Date.now() - new Date(last).getTime()) / H;
      if (hrs > cfg.blogStuckHours) { if (await fire(cfg, 'blog_stuck', `📝 El *blog automático* no publica desde hace ${Math.round(hrs)} h. Revisa el autopiloto o el crédito de la IA.`)) fired.push('blog_stuck'); }
    }
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

  // 5) ANOMALÍA (Fase 3): compara la última hora con lo "normal" de esa MISMA hora
  //    del reloj en los últimos 7 días. Si se desvía mucho, avisa. Sin librerías:
  //    media + desviación estándar sobre 7 muestras (una por día).
  if (cfg.anomaly) {
    try {
      const now = Date.now();
      const countIn = async (fromMs: number, toMs: number) => {
        const { count } = await supabaseAdmin.from('activity_events').select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(fromMs).toISOString()).lt('created_at', new Date(toMs).toISOString());
        return count || 0;
      };
      const cur = await countIn(now - H, now);
      const samples: number[] = [];
      for (let d = 1; d <= 7; d++) { samples.push(await countIn(now - H - d * 24 * H, now - d * 24 * H)); }
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
      const varr = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
      const std = Math.sqrt(varr);
      // Solo con suficiente historial "normal" (evita falsos positivos al arrancar).
      if (mean >= 12) {
        if (cur < mean - 2 * std && cur < mean * 0.45) {
          if (await fire(cfg, 'anomaly_low', `🧠 *Actividad anormalmente baja*: ${cur} en la última hora vs ~${Math.round(mean)} habitual a esta hora. Algo podría estar roto.`)) fired.push('anomaly_low');
        } else if (cur > mean + 3 * std && cur > mean * 2.5) {
          if (await fire(cfg, 'anomaly_high', `🚀 *Pico inusual de actividad*: ${cur} en la última hora vs ~${Math.round(mean)} habitual. ¿Viralización, campaña o abuso?`)) fired.push('anomaly_high');
        }
      }
    } catch {}
  }

  // 6) BACKUP viejo: la copia más reciente (last_at o historial) supera el umbral.
  //    Corre cada 15 min, así que un backup que dejó de hacerse se detecta el mismo día.
  if ((cfg.backupStaleDays || 0) > 0) {
    try {
      const { data: bk } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'backup').maybeSingle();
      const v = (bk as any)?.value || {};
      const stamps = [v.last_at, ...((v.history || []) as any[]).map((h) => h?.at)]
        .map((s) => (s ? new Date(s).getTime() : 0)).filter((n) => Number.isFinite(n) && n > 0);
      const newest = stamps.length ? Math.max(...stamps) : 0;
      if (!newest) {
        if (await fire(cfg, 'backup_none', `🗄️ *Sin copias de seguridad registradas.* Revisa el backup automático (GitHub Actions).`)) fired.push('backup_none');
      } else {
        const days = (Date.now() - newest) / (24 * H);
        if (days >= cfg.backupStaleDays) { if (await fire(cfg, 'backup_stale', `🗄️ *La última copia tiene ${Math.floor(days)} día(s)* (umbral ${cfg.backupStaleDays}). El backup pudo detenerse.`)) fired.push('backup_stale'); }
      }
    } catch {}
  }

  // Persistir los "_sent" actualizados (enfriamientos).
  try { await saveSetting('monitor_alerts', cfg); } catch {}
  return { checked: 6, fired };
}
