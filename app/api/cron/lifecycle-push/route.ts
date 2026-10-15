import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { emitNotif, loadNotifConfig } from '@/lib/emitNotif';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Push de ACTIVACIÓN para el usuario nuevo / inactivo. Corre 1 vez al día.
//  · welcome          → se registró hace poco (abrió la app: tiene dispositivo).
//  · connect_reminder → lleva 1–7 días y aún NO conectó una cuenta de bróker.
//  · comeback         → no entra hace 7+ días (profiles.last_seen_at).
// El push SOLO llega a quien tiene dispositivo (push_subscriptions web o
// native_push_tokens FCM); al que nunca abrió la app lo cubre el correo de
// onboarding. ignorePlan:true → llega también a Free (son avisos de activación).
// Anti-duplicado: no repite un tipo si ya se mandó ese mismo aviso hace poco
// (se mira el historial de 'notifications' por kind). Protegido con CRON_SECRET.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${secret}` || q === secret;
}

const day = 86400000;

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try {
    const now = Date.now();
    const cfg = await loadNotifConfig();

    // Quién tiene DISPOSITIVO (si no, el push no llega → lo cubre el email).
    const withDevice = new Set<string>();
    try { const { data } = await supabaseAdmin.from('native_push_tokens').select('user_id'); (data || []).forEach((r: any) => r.user_id && withDevice.add(r.user_id)); } catch {}
    try { const { data } = await supabaseAdmin.from('push_subscriptions').select('user_id'); (data || []).forEach((r: any) => r.user_id && withDevice.add(r.user_id)); } catch {}
    if (!withDevice.size) return NextResponse.json({ ok: true, welcome: 0, connect: 0, comeback: 0, note: 'nadie con dispositivo' });

    const ids = Array.from(withDevice);
    // Perfiles de los que tienen dispositivo: fecha de alta, idioma, nombre, última visita.
    const { data: profs } = await supabaseAdmin.from('profiles')
      .select('id,lang,full_name,created_at,last_seen_at').in('id', ids);

    // Quién YA conectó al menos una cuenta de bróker (para no molestar con "conecta").
    const hasAcc = new Set<string>();
    try { const { data } = await supabaseAdmin.from('trading_accounts').select('user_id').in('user_id', ids); (data || []).forEach((r: any) => r.user_id && hasAcc.add(r.user_id)); } catch {}

    // Historial reciente de estos avisos (anti-duplicado por kind).
    const sent: Record<string, Set<string>> = { welcome: new Set(), connect_reminder: new Set(), comeback: new Set() };
    try {
      const since = new Date(now - 30 * day).toISOString();
      const { data } = await supabaseAdmin.from('notifications')
        .select('user_id,kind,created_at')
        .in('user_id', ids)
        .in('kind', ['welcome', 'connect_reminder', 'comeback'])
        .gte('created_at', since);
      (data || []).forEach((r: any) => { if (sent[r.kind]) sent[r.kind].add(r.user_id); });
    } catch {}

    let welcome = 0, connect = 0, comeback = 0;
    for (const p of (profs || []) as any[]) {
      const uid = p.id;
      const lang = p.lang === 'en' ? 'en' : 'es';
      const name = (p.full_name || '').split(' ')[0] || (lang === 'en' ? 'trader' : 'trader');
      const ageDays = (now - new Date(p.created_at || now).getTime()) / day;
      const idleDays = p.last_seen_at ? (now - new Date(p.last_seen_at).getTime()) / day : 999;
      const vars = { name };

      // 1) Bienvenida: registrado hace ≤2 días y nunca se le mandó.
      if (ageDays <= 2 && !sent.welcome.has(uid)) {
        try { await emitNotif(uid, 'welcome', { lang, cfg, vars, ignorePlan: true }); welcome++; } catch {}
        continue; // un solo push por usuario por corrida
      }
      // 2) Conecta tu cuenta: 1–7 días, sin bróker, no enviado antes.
      if (ageDays >= 1 && ageDays <= 7 && !hasAcc.has(uid) && !sent.connect_reminder.has(uid)) {
        try { await emitNotif(uid, 'connect_reminder', { lang, cfg, vars, ignorePlan: true }); connect++; } catch {}
        continue;
      }
      // 3) Reenganche: inactivo 7+ días y no reenganchado en los últimos 30.
      if (idleDays >= 7 && !sent.comeback.has(uid)) {
        try { await emitNotif(uid, 'comeback', { lang, cfg, vars, ignorePlan: true }); comeback++; } catch {}
      }
    }
    return NextResponse.json({ ok: true, welcome, connect, comeback });
  } catch (e: any) {
    await logError('lifecycle_push', e);
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
