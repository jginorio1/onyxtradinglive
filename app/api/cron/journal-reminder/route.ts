import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { emitNotif, loadNotifConfig } from '@/lib/emitNotif';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Recordatorio de diario. Una vez al día busca traders con operaciones
// recientes SIN documentar y les manda el aviso "journal_reminder" (campana /
// push / Telegram, según lo que el dueño deje activo). Dedup diario para no
// repetir. Protegido con CRON_SECRET.
// ============================================================
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${secret}` || q === secret;
}

// ¿La entrada de diario tiene sustancia? (misma regla que la UI)
function documented(e: any): boolean {
  return !!(e.grade || e.emotion || (e.notes && String(e.notes).trim())
    || e.image_url || (e.tags?.length) || (e.market_tags?.length) || (e.error_tags?.length));
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const cfg = await loadNotifConfig();
    if (!cfg['journal_reminder']?.on) return NextResponse.json({ ok: true, skipped: 'off' });

    // Operaciones cerradas en los últimos 3 días (ventana en la que aún se
    // recuerda el trade). Se agrupan por usuario.
    const cut = new Date(Date.now() - 3 * 864e5).toISOString();
    const { data: trades } = await supabaseAdmin
      .from('trades').select('id,user_id,close_time').gte('close_time', cut).limit(20000);
    const rows = trades || [];
    if (!rows.length) return NextResponse.json({ ok: true, users: 0 });

    // Diario ya escrito para esas operaciones.
    const ids = rows.map((r: any) => r.id);
    const docSet = new Set<string>();
    for (let i = 0; i < ids.length; i += 1000) {
      const chunk = ids.slice(i, i + 1000);
      const { data: js } = await supabaseAdmin
        .from('trade_journal').select('trade_id,grade,emotion,notes,image_url,tags,market_tags,error_tags').in('trade_id', chunk);
      (js || []).forEach((e: any) => { if (documented(e)) docSet.add(e.trade_id); });
    }

    // Cuántas sin documentar por usuario.
    const pend: Record<string, number> = {};
    for (const r of rows as any[]) { if (!docSet.has(r.id)) pend[r.user_id] = (pend[r.user_id] || 0) + 1; }
    const userIds = Object.keys(pend).filter((u) => pend[u] > 0);
    if (!userIds.length) return NextResponse.json({ ok: true, users: 0 });

    // Idioma de cada trader.
    const { data: profs } = await supabaseAdmin.from('profiles').select('id,lang').in('id', userIds);
    const langOf: Record<string, string> = {};
    (profs || []).forEach((p: any) => { langOf[p.id] = p.lang === 'en' ? 'en' : 'es'; });

    let sent = 0;
    for (const uid of userIds) {
      await emitNotif(uid, 'journal_reminder', { lang: langOf[uid] || 'es', cfg, vars: { count: pend[uid] }, once: 'journal_reminder' });
      sent++;
    }
    return NextResponse.json({ ok: true, users: userIds.length, sent });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
