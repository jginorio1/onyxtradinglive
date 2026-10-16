import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendMessage } from '@/lib/telegram';

// Avisa al equipo (todos los admins con Telegram vinculado) que entró un
// ticket nuevo. Nunca lanza: si falla o falta config, no rompe la creación.
export async function notifyNewTicket(opts: { email: string; subject: string; isLead?: boolean }) {
  try {
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('telegram_chat_id')
      .eq('is_admin', true)
      .not('telegram_chat_id', 'is', null);
    if (!admins?.length) return;

    const who = opts.email || (opts.isLead ? 'visitante' : 'trader');
    const tag = opts.isLead ? '🟣 Lead' : '🎫 Ticket';
    const text =
      `${tag} nuevo en soporte\n` +
      `<b>${(opts.subject || 'Sin asunto').slice(0, 120)}</b>\n` +
      `De: ${who}\n\n` +
      `Ábrelo en Admin → Soporte para responder.`;

    await Promise.all(
      admins
        .map((a: any) => a.telegram_chat_id)
        .filter(Boolean)
        .map((chatId: string) => sendMessage(chatId, text, { kind: 'support_new' })),
    );
  } catch { /* silencioso */ }
}

// Difunde un texto (HTML) a todo el equipo con Telegram vinculado. Reutilizado por
// el resumen semanal de Insights de soporte. Nunca lanza.
export async function broadcastTeam(text: string, kind = 'support_digest'): Promise<number> {
  try {
    const { data: admins } = await supabaseAdmin
      .from('profiles').select('telegram_chat_id').eq('is_admin', true).not('telegram_chat_id', 'is', null);
    const ids = (admins || []).map((a: any) => a.telegram_chat_id).filter(Boolean);
    if (!ids.length) return 0;
    await Promise.all(ids.map((chatId: string) => sendMessage(chatId, text, { kind })));
    return ids.length;
  } catch { return 0; }
}
