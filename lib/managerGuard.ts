import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { mergeConfig, ManagerConfig } from '@/lib/manager';
import { alertUser } from '@/lib/telegram';

// ============================================================
// El guardián. Decide si el trader puede abrir una operación ahora mismo.
//
// Toda la decisión se toma aquí, en el servidor. El EA no razona: recibe
// "puedes / no puedes" con un motivo y lo aplica. Así, si alguien manipula
// el EA, solo se manipula a sí mismo: el registro de lo que pasó es nuestro.
// ============================================================

export type Verdict = {
  allow_new: boolean;         // ¿puede abrir una operación nueva?
  close_all: boolean;         // ¿hay que cerrar lo que esté abierto?
  reason: string;             // schedule | daily_loss | total_loss | target | tilt | cooldown | max_trades | news | ''
  message_es: string;
  message_en: string;
  severity: 'ok' | 'warn' | 'block';
  can_override: boolean;      // ¿puede pedir saltarse esta regla?
  override_ready_at: string | null; // cuándo terminará la espera, si ya la pidió
  usage: {                    // para pintar las barras del panel
    daily_loss_used_pct: number;
    total_loss_used_pct: number;
    target_used_pct: number;
    trades_today: number;
    max_trades_day: number;
  };
};

const OK: Verdict = {
  allow_new: true, close_all: false, reason: '', message_es: '', message_en: '',
  severity: 'ok', can_override: false, override_ready_at: null,
  usage: { daily_loss_used_pct: 0, total_loss_used_pct: 0, target_used_pct: 0, trades_today: 0, max_trades_day: 0 },
};

// ------------------------------------------------------------
// Ayudas de tiempo
// ------------------------------------------------------------

// Hora local del trader, a partir de UTC y su desfase en minutos
function localNow(tzOffsetMin: number, at = new Date()) {
  return new Date(at.getTime() + tzOffsetMin * 60000);
}

// Minutos desde medianoche de un "HH:MM"
function toMin(hhmm: string): number {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// La clave del día del bróker, corriendo la medianoche a `resetHour`.
// Ejemplo: si el día de la firma empieza a las 17:00, a las 18:00 del lunes
// ya estamos en el "día" del martes.
export function brokerDayKey(serverOffsetMin: number, resetHour: number, at = new Date()): string {
  const broker = new Date(at.getTime() + (serverOffsetMin || 0) * 60000);
  const shifted = new Date(broker.getTime() - (resetHour || 0) * 3600000);
  return shifted.toISOString().slice(0, 10);
}

// ¿Está la hora local dentro de alguna franja activa?
function insideWindows(cfg: ManagerConfig, at: Date): boolean {
  const wins = cfg.plan.windows.filter((w: any) => w.on);
  if (!wins.length) return false;
  const mins = at.getUTCHours() * 60 + at.getUTCMinutes(); // `at` ya viene desplazado a hora local
  return wins.some((w: any) => {
    const a = toMin(w.from), b = toMin(w.to);
    // franja que cruza la medianoche (ej. 22:00 → 02:00)
    return a <= b ? (mins >= a && mins < b) : (mins >= a || mins < b);
  });
}

// ------------------------------------------------------------
// Evaluación principal
// ------------------------------------------------------------
export async function evaluate(opts: {
  userId: string;
  accountId: string;
  serverOffsetMin: number;
  balance: number;
  equity: number;
  openCount: number;
  rawConfig: any;
  enabled: boolean;
  newsBlocked?: boolean;       // lo calcula quien llama, con el calendario
  newsTitle?: string;
}): Promise<Verdict> {
  const cfg = mergeConfig(opts.rawConfig);
  if (!opts.enabled) return { ...OK };

  const now = new Date();
  const v: Verdict = JSON.parse(JSON.stringify(OK));

  // --- 1) Anclar el día ---
  const dayKey = brokerDayKey(opts.serverOffsetMin, cfg.limits.reset_hour, now);
  const { data: prev } = await supabaseAdmin.from('manager_state').select('*').eq('account_id', opts.accountId).maybeSingle();

  let st: any = prev;
  const newDay = !prev || prev.day_key !== dayKey;
  if (newDay) {
    st = {
      user_id: opts.userId,
      account_id: opts.accountId,
      day_key: dayKey,
      day_start_balance: opts.balance,
      day_start_equity: opts.equity,
      initial_balance: prev?.initial_balance ?? opts.balance,
      trades_today: 0,
      losses_streak: prev?.losses_streak ?? 0,
      last_loss_at: prev?.last_loss_at ?? null,
      blocked: false,
      blocked_reason: null,
      blocked_until: null,
      override_until: prev?.override_until ?? null,
      override_requested_at: prev?.override_requested_at ?? null,
      updated_at: now.toISOString(),
    };
    await supabaseAdmin.from('manager_state').upsert(st, { onConflict: 'account_id' });
  }

  v.usage.trades_today = Number(st?.trades_today || 0);
  v.usage.max_trades_day = Number(cfg.plan.max_trades_day || 0);

  // --- 2) ¿Tiene un permiso temporal activo? ---
  const overrideActive = st?.override_until && new Date(st.override_until) > now;
  if (st?.override_requested_at && !overrideActive) {
    const ready = new Date(new Date(st.override_requested_at).getTime() + cfg.plan.friction_min * 60000);
    if (ready > now) v.override_ready_at = ready.toISOString();
  }

  // --- 3) Límites de la cuenta (esto no se puede saltar nunca) ---
  if (cfg.limits.on) {
    const base = cfg.limits.base === 'day_start_equity' ? Number(st?.day_start_equity || opts.equity)
      : cfg.limits.base === 'initial_balance' ? Number(st?.initial_balance || opts.balance)
        : Number(st?.day_start_balance || opts.balance);
    const initial = Number(st?.initial_balance || opts.balance);

    const dayPnl = opts.equity - base;               // lo que llevas hoy
    const totalPnl = opts.equity - initial;          // desde que abriste la cuenta

    // margen de seguridad: si reservas el 20%, tu tope real es el 80% del límite
    const margin = 1 - Number(cfg.limits.safety_margin || 0) / 100;

    // pérdida diaria
    if (cfg.limits.daily_loss > 0) {
      const cap = cfg.limits.daily_loss_pct ? base * (cfg.limits.daily_loss / 100) : Number(cfg.limits.daily_loss);
      const effective = cap * margin;
      v.usage.daily_loss_used_pct = cap > 0 ? Math.max(0, Math.min(100, (-dayPnl / cap) * 100)) : 0;
      if (dayPnl <= -effective) {
        return finish(v, {
          reason: 'daily_loss', severity: 'block', canOverride: false,
          close: cfg.limits.on_breach === 'close_and_block',
          es: `Has llegado a tu pérdida máxima del día (${fmt(-dayPnl)} de ${fmt(cap)}). Se acabó por hoy.`,
          en: `You hit your daily loss limit (${fmt(-dayPnl)} of ${fmt(cap)}). Done for today.`,
        }, opts, st, cfg);
      }
    }

    // pérdida total
    if (cfg.limits.total_loss > 0) {
      const cap = cfg.limits.total_loss_pct ? initial * (cfg.limits.total_loss / 100) : Number(cfg.limits.total_loss);
      const effective = cap * margin;
      v.usage.total_loss_used_pct = cap > 0 ? Math.max(0, Math.min(100, (-totalPnl / cap) * 100)) : 0;
      if (totalPnl <= -effective) {
        return finish(v, {
          reason: 'total_loss', severity: 'block', canOverride: false,
          close: cfg.limits.on_breach === 'close_and_block',
          es: `Has llegado a tu pérdida máxima total (${fmt(-totalPnl)} de ${fmt(cap)}).`,
          en: `You hit your maximum total loss (${fmt(-totalPnl)} of ${fmt(cap)}).`,
        }, opts, st, cfg);
      }
    }

    // objetivo del día: al llegar, se para (esto sí se puede saltar)
    if (cfg.limits.daily_target > 0) {
      const goal = cfg.limits.daily_target_pct ? base * (cfg.limits.daily_target / 100) : Number(cfg.limits.daily_target);
      v.usage.target_used_pct = goal > 0 ? Math.max(0, Math.min(100, (dayPnl / goal) * 100)) : 0;
      if (dayPnl >= goal && !overrideActive) {
        return finish(v, {
          reason: 'target', severity: 'block', canOverride: true, close: false,
          es: `Ya has hecho tu objetivo del día (${fmt(dayPnl)}). Guárdalo.`,
          en: `You already hit today's target (${fmt(dayPnl)}). Bank it.`,
        }, opts, st, cfg);
      }
    }

    // posiciones simultáneas
    if (cfg.limits.max_open > 0 && opts.openCount >= cfg.limits.max_open) {
      return finish(v, {
        reason: 'max_open', severity: 'block', canOverride: true, close: false,
        es: `Ya tienes ${opts.openCount} posiciones abiertas, que es tu máximo.`,
        en: `You already have ${opts.openCount} open positions, which is your maximum.`,
      }, opts, st, cfg);
    }
  }

  // --- 4) Noticias ---
  if (cfg.news.on && opts.newsBlocked) {
    const t = opts.newsTitle || '';
    return finish(v, {
      reason: 'news', severity: cfg.news.action === 'warn' ? 'warn' : 'block',
      canOverride: cfg.news.action !== 'close_and_block',
      close: cfg.news.action === 'close_and_block',
      es: `Hay una noticia de alto impacto cerca${t ? ` (${t})` : ''}.`,
      en: `A high-impact news event is near${t ? ` (${t})` : ''}.`,
    }, opts, st, cfg);
  }

  // --- 5) Mi plan de trading ---
  if (cfg.plan.on) {
    const loc = localNow(cfg.plan.tz_offset_min, now);
    const dow = loc.getUTCDay();

    // freno por racha de pérdidas
    if (cfg.plan.tilt.on && Number(st?.losses_streak || 0) >= cfg.plan.tilt.losses) {
      const until = st?.last_loss_at ? new Date(new Date(st.last_loss_at).getTime() + cfg.plan.tilt.pause_min * 60000) : null;
      if (!until || until > now) {
        return finish(v, {
          reason: 'tilt', severity: 'block', canOverride: cfg.plan.rigidity !== 'hard', close: false,
          es: `Llevas ${st.losses_streak} pérdidas seguidas. Para, respira y vuelve más tarde.`,
          en: `You have ${st.losses_streak} losses in a row. Stop, breathe, come back later.`,
        }, opts, st, cfg);
      }
    }

    // enfriamiento después de una pérdida
    if (cfg.plan.cooldown_min > 0 && st?.last_loss_at) {
      const until = new Date(new Date(st.last_loss_at).getTime() + cfg.plan.cooldown_min * 60000);
      if (until > now) {
        const mins = Math.ceil((until.getTime() - now.getTime()) / 60000);
        return finish(v, {
          reason: 'cooldown', severity: 'block', canOverride: cfg.plan.rigidity !== 'hard', close: false,
          es: `Acabas de cerrar en pérdida. Espera ${mins} minuto(s) antes de la siguiente.`,
          en: `You just closed a loss. Wait ${mins} more minute(s) before the next one.`,
        }, opts, st, cfg);
      }
    }

    // número de operaciones del día
    if (cfg.plan.max_trades_day > 0 && Number(st?.trades_today || 0) >= cfg.plan.max_trades_day) {
      return finish(v, {
        reason: 'max_trades', severity: 'block', canOverride: cfg.plan.rigidity !== 'hard', close: false,
        es: `Ya llevas ${st.trades_today} operaciones hoy, que es tu tope.`,
        en: `You already took ${st.trades_today} trades today, which is your cap.`,
      }, opts, st, cfg);
    }

    // día y franja horaria
    const dayOk = cfg.plan.days.includes(dow);
    const winOk = insideWindows(cfg, loc);
    if (!dayOk || !winOk) {
      const wins = cfg.plan.windows.filter((w: any) => w.on).map((w: any) => `${w.from}–${w.to}`).join(', ');
      return finish(v, {
        reason: 'schedule', severity: cfg.plan.rigidity === 'soft' ? 'warn' : 'block',
        canOverride: cfg.plan.rigidity !== 'hard', close: false,
        es: !dayOk ? 'Hoy no es un día de los que operas según tu plan.'
          : `Estás fuera de tu horario${wins ? ` (${wins})` : ''}.`,
        en: !dayOk ? 'Today is not one of your trading days.'
          : `You are outside your trading hours${wins ? ` (${wins})` : ''}.`,
      }, opts, st, cfg);
    }
  }

  // Todo en orden
  await supabaseAdmin.from('manager_state')
    .update({ blocked: false, blocked_reason: null, updated_at: now.toISOString() })
    .eq('account_id', opts.accountId);
  return v;
}

function fmt(n: number) { return (n >= 0 ? '' : '-') + '$' + Math.abs(n).toFixed(2); }

// Guarda el bloqueo, deja el rastro en el historial y devuelve el veredicto
async function finish(v: Verdict, r: {
  reason: string; severity: 'warn' | 'block'; canOverride: boolean; close: boolean; es: string; en: string;
}, opts: any, st: any, cfg: ManagerConfig): Promise<Verdict> {
  const now = new Date();
  const overrideActive = st?.override_until && new Date(st.override_until) > now;

  // Si tiene permiso temporal y esta regla admite saltarse, le dejamos pasar
  if (overrideActive && r.canOverride) {
    v.allow_new = true;
    v.severity = 'warn';
    v.reason = r.reason;
    v.message_es = r.es + ' (te lo estás saltando a propósito)';
    v.message_en = r.en + ' (you are deliberately overriding this)';
    return v;
  }

  v.allow_new = r.severity !== 'block';
  v.close_all = r.close;
  v.reason = r.reason;
  v.severity = r.severity;
  v.can_override = r.canOverride && cfg.plan.rigidity !== 'hard';
  v.message_es = r.es;
  v.message_en = r.en;

  const wasBlocked = st?.blocked && st?.blocked_reason === r.reason;
  await supabaseAdmin.from('manager_state').upsert({
    user_id: opts.userId,
    account_id: opts.accountId,
    day_key: st?.day_key ?? null,
    blocked: r.severity === 'block',
    blocked_reason: r.reason,
    updated_at: now.toISOString(),
  }, { onConflict: 'account_id' });

  // Solo apuntamos el evento la primera vez, para no llenar el historial
  // con el mismo bloqueo repetido en cada sincronización.
  if (!wasBlocked && r.severity === 'block') {
    await supabaseAdmin.from('manager_events').insert({
      user_id: opts.userId,
      account_id: opts.accountId,
      kind: 'blocked',
      detail: r.es,
      meta: { reason: r.reason },
    });

    // Aviso a Telegram, si lo tiene conectado. Es la primera vez que salta
    // este bloqueo, así que no lo repetimos en cada heartbeat.
    // Las pérdidas límite van como 'limits'; el resto como 'blocks'.
    const kind = (r.reason === 'daily_loss' || r.reason === 'total_loss' || r.reason === 'target') ? 'limits' : 'blocks';
    const head = kind === 'limits' ? '🛑 Onyx Guardian' : '⏸️ Onyx Guardian';
    alertUser(opts.userId, kind, `${head}\n${r.es}`).catch(() => {});
  }
  return v;
}

// ------------------------------------------------------------
// Contadores del día: los llama el sync cuando llegan operaciones cerradas
// ------------------------------------------------------------
export async function registerClosedTrades(accountId: string, closed: any[]) {
  if (!closed?.length) return;
  const { data: st } = await supabaseAdmin.from('manager_state').select('*').eq('account_id', accountId).maybeSingle();
  if (!st) return;

  let trades = Number(st.trades_today || 0);
  let streak = Number(st.losses_streak || 0);
  let lastLoss: string | null = st.last_loss_at;

  // en orden cronológico para que la racha se cuente bien
  const sorted = [...closed].sort((a, b) => Number(a.closeTime || 0) - Number(b.closeTime || 0));
  for (const t of sorted) {
    trades += 1;
    const net = Number(t.profit || 0) + Number(t.commission || 0) + Number(t.swap || 0);
    if (net < 0) {
      streak += 1;
      lastLoss = t.closeTime ? new Date(Number(t.closeTime) * 1000).toISOString() : new Date().toISOString();
    } else if (net > 0) {
      streak = 0;
    }
  }

  await supabaseAdmin.from('manager_state').update({
    trades_today: trades, losses_streak: streak, last_loss_at: lastLoss, updated_at: new Date().toISOString(),
  }).eq('account_id', accountId);
}

// ------------------------------------------------------------
// ¿Hay una noticia de alto impacto en la ventana configurada?
// Devuelve el título si la hay.
// ------------------------------------------------------------
export function newsNear(events: any[], cfg: ManagerConfig, at = new Date()): string | null {
  if (!cfg.news.on || !Array.isArray(events)) return null;
  const wanted = cfg.news.impact === 'high' ? ['High'] : ['High', 'Medium'];
  const beforeMs = cfg.news.before_min * 60000;
  const afterMs = cfg.news.after_min * 60000;

  for (const e of events) {
    if (!wanted.includes(e.impact)) continue;
    const t = Date.parse(e.date);
    if (!isFinite(t)) continue;
    if (at.getTime() >= t - beforeMs && at.getTime() <= t + afterMs) {
      return `${e.currency || ''} ${e.title || ''}`.trim();
    }
  }
  return null;
}
