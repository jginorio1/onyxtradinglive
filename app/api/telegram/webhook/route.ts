import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendMessage } from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Webhook del bot de Telegram.
//
// Telegram llama aquí cada vez que alguien escribe al bot. Nos interesa
// sobre todo el /start con el código de vínculo, que llega cuando el
// usuario pulsa el enlace t.me/<bot>?start=<codigo> desde su cuenta.
//
// Seguridad: Telegram añade un token secreto en la cabecera si lo
// configuramos al registrar el webhook. Lo comprobamos aquí.
// ============================================================
export async function POST(req: Request) {
  try {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret && req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const update = await req.json().catch(() => null);
    const msg = update?.message;
    const chatId = msg?.chat?.id ? String(msg.chat.id) : '';
    const text = String(msg?.text || '').trim();
    if (!chatId || !text) return NextResponse.json({ ok: true });

    const username = msg?.from?.username ? '@' + msg.from.username : '';

    // /start CODIGO  → vincular esta cuenta de Telegram con el usuario
    if (text.startsWith('/start')) {
      const code = text.split(/\s+/)[1]?.toUpperCase() || '';
      if (!code) {
        await sendMessage(chatId,
          'Hola 👋 Soy Onyx Guardian.\nPara recibir avisos, entra en tu cuenta en onyxtradinglive.com → Avisos → Conectar Telegram, y pulsa el enlace desde ahí.');
        return NextResponse.json({ ok: true });
      }

      const { data: prof } = await supabaseAdmin
        .from('profiles').select('id,telegram_chat_id').eq('telegram_link_code', code).maybeSingle();

      if (!prof) {
        await sendMessage(chatId, 'Ese código no es válido o ya caducó. Genera uno nuevo desde tu cuenta.');
        return NextResponse.json({ ok: true });
      }

      // Un chat de Telegram no puede quedar atado a dos cuentas a la vez
      await supabaseAdmin.from('profiles')
        .update({ telegram_chat_id: null })
        .eq('telegram_chat_id', chatId).neq('id', prof.id);

      await supabaseAdmin.from('profiles').update({
        telegram_chat_id: chatId,
        telegram_username: username || null,
        telegram_link_code: null,
        telegram_linked_at: new Date().toISOString(),
      }).eq('id', prof.id);

      await sendMessage(chatId,
        '✅ <b>Conectado</b>\nYa recibirás aquí los avisos de Onyx Guardian: bloqueos, límites de riesgo y alertas de fondeo.\n\nElige qué avisos quieres en tu cuenta → Avisos. Para dejar de recibirlos escribe /stop.');
      return NextResponse.json({ ok: true });
    }

    // /stop  → desvincular desde el propio Telegram
    if (text === '/stop') {
      await supabaseAdmin.from('profiles')
        .update({ telegram_chat_id: null, telegram_linked_at: null })
        .eq('telegram_chat_id', chatId);
      await sendMessage(chatId, 'Listo, no volverás a recibir avisos. Puedes reconectar cuando quieras desde tu cuenta.');
      return NextResponse.json({ ok: true });
    }

    // Cualquier otra cosa: una ayuda breve
    await sendMessage(chatId, 'Soy el bot de avisos de Onyx Guardian. Escribe /stop para dejar de recibir avisos.');
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // Devolvemos 200 igualmente: si respondemos error, Telegram reintenta en bucle
    return NextResponse.json({ ok: true });
  }
}
