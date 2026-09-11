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
