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

    // /stop  → desvincular desde el propio Telegram
    if (text === '/stop') {
      await supabaseAdmin.from('profiles')
        .update({ telegram_chat_id: null, telegram_linked_at: null })
        .eq('telegram_chat_id', chatId);
      await sendMessage(chatId, 'Listo, no volverás a recibir avisos. Puedes reconectar cuando quieras desde tu cuenta.');
      return NextResponse.json({ ok: true });
    }

    // /estado  → resumen rápido del día, sin abrir la web
    if (text === '/estado' || text === '/status') {
      const { data: prof } = await supabaseAdmin.from('profiles')
        .select('id').eq('telegram_chat_id', chatId).maybeSingle();
      if (!prof) {
        await sendMessage(chatId, 'No reconozco este chat. Conéctate primero desde tu cuenta → Avisos.');
        return NextResponse.json({ ok: true });
      }
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: accs } = await supabaseAdmin.from('trading_accounts').select('id').eq('user_id', prof.id);
      const ids = (accs || []).map((a: any) => a.id);
      let n = 0, net = 0;
      if (ids.length) {
        const { data: tr } = await supabaseAdmin.from('trades')
          .select('profit,commission,swap').in('account_id', ids).gte('close_time', since);
        n = (tr || []).length;
        net = (tr || []).reduce((s: number, t: any) => s + Number(t.profit || 0) + Number(t.commission || 0) + Number(t.swap || 0), 0);
      }
      const { count: blocks } = await supabaseAdmin.from('manager_events')
        .select('*', { count: 'exact', head: true }).eq('user_id', prof.id).eq('kind', 'blocked').gte('created_at', since);
      const sign = net >= 0 ? '+' : '-';
      await sendMessage(chatId,
        `📊 <b>Últimas 24h</b>\nOperaciones: ${n}\nResultado: ${sign}$${Math.abs(net).toFixed(2)}\nEl Guardian te frenó: ${blocks || 0} vez(ces)`);
      return NextResponse.json({ ok: true });
    }

    // Sacamos el código del mensaje. Vale de dos formas:
    //   · "/start CODIGO"  — cuando Telegram muestra el botón Start
    //   · "CODIGO" a secas  — cuando el chat ya existía y no aparece el Start,
    //                         así que el usuario lo pega a mano
    let code = '';
    if (text.startsWith('/start')) {
      code = text.split(/\s+/)[1]?.toUpperCase() || '';
    } else if (/^[A-Z0-9]{6,10}$/i.test(text)) {
      code = text.toUpperCase();
    }

    if (code) {
      const { data: prof } = await supabaseAdmin
        .from('profiles').select('id,telegram_chat_id').eq('telegram_link_code', code).maybeSingle();

      if (!prof) {
        await sendMessage(chatId, 'Ese código no es válido o ya caducó. Genera uno nuevo desde tu cuenta → Avisos.');
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

    // /start sin código, o cualquier otra cosa: ayuda
    await sendMessage(chatId,
      'Hola 👋 Soy Onyx Guardian.\nPara conectarte, entra en onyxtradinglive.com → Mi cuenta → Avisos → Conectar Telegram, y pega aquí el código que te dé.\n\nComandos: /estado (resumen del día) · /stop (dejar de recibir).');
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // Devolvemos 200 igualmente: si respondemos error, Telegram reintenta en bucle
    return NextResponse.json({ ok: true });
  }
}
