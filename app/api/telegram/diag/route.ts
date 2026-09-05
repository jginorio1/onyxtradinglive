import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Diagnóstico de Telegram, solo admin. No cambia nada: solo mira.
// Dice si el token es válido, cómo está el webhook, y si hay un código
// de vínculo pendiente ahora mismo.
export async function GET() {
  try {
    const { isAdmin, user } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const hasToken = !!token;
    const hasSecret = !!process.env.TELEGRAM_WEBHOOK_SECRET;

    let me: any = null, hook: any = null;
    if (token) {
      me = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json()).catch(() => null);
      hook = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json()).catch(() => null);
    }

    // ¿Tengo yo (el owner) un código pendiente y un chat vinculado?
    const { data: mine } = await supabaseAdmin.from('profiles')
      .select('telegram_chat_id,telegram_link_code,telegram_linked_at')
      .eq('id', user.id).maybeSingle() as any;

    return NextResponse.json({
      env: { hasToken, hasSecret },
      bot: me?.ok ? { id: me.result.id, username: me.result.username } : { error: me?.description || 'token inválido o ausente' },
      webhook: hook?.ok ? {
        url: hook.result.url,
        pending: hook.result.pending_update_count,
        lastError: hook.result.last_error_message || null,
        lastErrorDate: hook.result.last_error_date || null,
      } : { error: 'no se pudo leer' },
      me: {
        chatLinked: !!mine?.telegram_chat_id,
        hasPendingCode: !!mine?.telegram_link_code,
        pendingCode: mine?.telegram_link_code || null,
        linkedAt: mine?.telegram_linked_at || null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
