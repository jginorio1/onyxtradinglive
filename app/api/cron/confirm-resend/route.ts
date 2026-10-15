import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSetting, saveSetting } from '@/lib/settings';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Reenvío automático del correo de confirmación a quien NO activó su cuenta.
// Dos recordatorios: a las ~24h y a las ~72h de registrarse (caben antes de que
// clean-signups borre las no confirmadas a los 7 días). Cada usuario recibe como
// máximo 2 reenvíos (anti-duplicado en el ajuste 'confirm_resend_log').
// Corre 1 vez al día. Protegido con CRON_SECRET.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${secret}` || q === secret;
}

const DAY = 864e5;

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try {
    const now = Date.now();
    // Log de reenvíos: { [userId]: 1 | 2 } (cuántos recordatorios se mandaron).
    const log = (await getSetting<Record<string, number>>('confirm_resend_log', {})) || {};
    const seen = new Set<string>();   // para limpiar del log a los que ya no existen/confirmaron

    let r1 = 0, r2 = 0;
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !data?.users?.length) break;
      for (const u of data.users) {
        const confirmed = (u as any).email_confirmed_at || (u as any).confirmed_at;
        const banned = (u as any).banned_until;
        if (confirmed || banned || !u.email) continue;   // ya activó, baneado o sin correo
        seen.add(u.id);
        const ageDays = (now - (u.created_at ? new Date(u.created_at).getTime() : now)) / DAY;
        const done = log[u.id] || 0;
        // 2º recordatorio (~72h) — solo si ya se mandó el 1º.
        if (ageDays >= 3 && done < 2) {
          try { const { error: e } = await (supabaseAdmin.auth as any).resend({ type: 'signup', email: u.email }); if (!e) { log[u.id] = 2; r2++; } } catch { /* rate limit u otro: se reintenta mañana */ }
        }
        // 1º recordatorio (~24h).
        else if (ageDays >= 1 && done < 1) {
          try { const { error: e } = await (supabaseAdmin.auth as any).resend({ type: 'signup', email: u.email }); if (!e) { log[u.id] = 1; r1++; } } catch {}
        }
      }
      if (data.users.length < 1000) break;
    }

    // Poda: quita del log a quien ya confirmó o fue borrado (no apareció sin confirmar).
    for (const id of Object.keys(log)) { if (!seen.has(id)) delete log[id]; }
    try { await saveSetting('confirm_resend_log', log); } catch {}

    return NextResponse.json({ ok: true, firstReminder: r1, secondReminder: r2 });
  } catch (e: any) {
    await logError('confirm_resend', e);
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
