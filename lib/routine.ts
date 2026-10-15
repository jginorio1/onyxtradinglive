// ============================================================
// Rutina diaria del trader: Check-in (mañana) y Check-out (noche).
// Cada trader tiene su ZONA HORARIA y la HORA EXACTA de cada recordatorio, así el
// aviso llega a su mañana/noche local en cualquier parte del mundo.
//   profiles.tz             IANA timezone (ej. 'America/Puerto_Rico'). Null = default.
//   profiles.checkin_at     'HH:MM' local (default 08:00)
//   profiles.checkout_at    'HH:MM' local (default 21:00)
//   profiles.checkin_sent_on / checkout_sent_on  'YYYY-MM-DD' local del último envío
// El cron /api/cron/checkin-tick corre cada 15 min y envía a quien le haya llegado su
// hora local y no se le haya enviado hoy. Encender/apagar y editar hora: Mi cuenta → Avisos.
// ============================================================

export const DEFAULT_TZ = 'America/New_York';
export const DEFAULT_CHECKIN = '08:00';
export const DEFAULT_CHECKOUT = '21:00';

// Lista de IANA válidas (chequeo barato) para no guardar basura.
export function isValidTz(tz: string): boolean {
  if (!tz || typeof tz !== 'string' || tz.length > 64) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

// Normaliza 'H:M' / '8:5' / '08:00' → 'HH:MM' 24h, o null si inválida.
export function normHHMM(s: any): string | null {
  const m = String(s || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mi = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
}

// Reloj de pared (hora local 'HH:MM') y fecha local 'YYYY-MM-DD' de AHORA en una tz.
export function wallClock(tz: string, at: Date = new Date()): { hhmm: string; date: string } {
  const z = isValidTz(tz) ? tz : DEFAULT_TZ;
  try {
    const dtf = new Intl.DateTimeFormat('en-CA', { timeZone: z, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    const p: any = {}; for (const x of dtf.formatToParts(at)) if (x.type !== 'literal') p[x.type] = x.value;
    const hh = p.hour === '24' ? '00' : p.hour;
    return { hhmm: `${hh}:${p.minute}`, date: `${p.year}-${p.month}-${p.day}` };
  } catch { return { hhmm: '00:00', date: at.toISOString().slice(0, 10) }; }
}

// ¿Ya pasó (o es) la hora `target` en el reloj local `nowHHMM`? Compara 'HH:MM' (ancho fijo).
export function timeReached(nowHHMM: string, target: string): boolean {
  const t = normHHMM(target) || DEFAULT_CHECKIN;
  return nowHHMM >= t;
}
