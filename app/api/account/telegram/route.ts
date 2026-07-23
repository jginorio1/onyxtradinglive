import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { makeLinkCode, BOT_USERNAME, telegramEnabled } from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PREFS = ['tg_alerts', 'tg_blocks', 'tg_limits', 'tg_manager', 'tg_funding', 'tg_daily'];

// GET · estado del vínculo + preferencias, para pintar la pantalla
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const { data: p } = await supabaseAdmin.from('profiles')
      .select('telegram_chat_id,telegram_username,telegram_linked_at,plan,tg_alerts,tg_blocks,tg_limits,tg_manager,tg_funding,tg_daily')
      .eq('id', user.id).maybeSingle() as any;

    const { data: plan } = await supabaseAdmin.from('plans')
      .select('capabilities').eq('id', p?.plan || 'free').maybeSingle();

    const prefs: any = {};
    PREFS.forEach((k) => { prefs[k] = (p as any)?.[k] ?? (k === 'tg_alerts'); });

    return NextResponse.json({
      available: telegramEnabled(),
      inPlan: !!plan?.capabilities?.telegram,
      linked: !!p?.telegram_chat_id,
      username: p?.telegram_username || '',
      linkedAt: p?.telegram_linked_at || null,
      bot: BOT_USERNAME,
      prefs,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}

// POST · acciones: generar enlace, desvincular, guardar preferencias
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const b = await req.json().catch(() => ({} as any));

    // Generar el enlace de vinculación (deep-link que abre el bot con el código)
    if (b.action === 'link') {
      const code = makeLinkCode();
      await supabaseAdmin.from('profiles').update({ telegram_link_code: code }).eq('id', user.id);
      return NextResponse.json({ ok: true, url: `https://t.me/${BOT_USERNAME}?start=${code}`, code });
    }

    // Desvincular desde la web
    if (b.action === 'unlink') {
      await supabaseAdmin.from('profiles')
        .update({ telegram_chat_id: null, telegram_username: null, telegram_linked_at: null, telegram_link_code: null })
        .eq('id', user.id);
      return NextResponse.json({ ok: true });
    }

    // Guardar preferencias de alertas
    if (b.action === 'prefs') {
      const fields: any = {};
      PREFS.forEach((k) => { if (b[k] !== undefined) fields[k] = !!b[k]; });
      if (Object.keys(fields).length) {
        await supabaseAdmin.from('profiles').update(fields).eq('id', user.id);
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown action', code: 'generic' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
