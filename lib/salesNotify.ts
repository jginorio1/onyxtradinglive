import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { salesSettings } from '@/lib/sales';
import { notify } from '@/lib/notify';
import { sendEmail } from '@/lib/mail';
import { sendMessage } from '@/lib/telegram';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

export type SalesEv = 'new_client' | 'first_paid' | 'commission' | 'payout';

// Avisa a un vendedor (por su rep_id) en su idioma, por in-app + correo + Telegram.
// Respeta los toggles de ajustes. Nunca rompe el flujo si un canal falla.
export async function notifyRep(repId: string, ev: SalesEv, data: { amount?: number; client?: string } = {}): Promise<void> {
  try {
    const s = await salesSettings();
    const on = ev === 'new_client' ? s.notify_new_client
      : ev === 'first_paid' ? s.notify_first_paid
      : ev === 'commission' ? s.notify_commission
      : s.notify_payout;
    if (on === false) return;

    const { data: rep } = await supabaseAdmin.from('sales_reps').select('user_id').eq('id', repId).maybeSingle();
    const uid = (rep as any)?.user_id;
    if (!uid) return;
    const { data: p } = await supabaseAdmin.from('profiles').select('email,lang,telegram_chat_id,tg_alerts').eq('id', uid).maybeSingle() as any;
    const es = !p || p.lang !== 'en';
    const amt = data.amount != null ? `$${Number(data.amount).toFixed(2)}` : '';
    const cli = data.client || (es ? 'Un cliente' : 'A client');

    const M: Record<SalesEv, { t: string; b: string }> = {
      new_client: { t: es ? '🎉 Cliente nuevo' : '🎉 New client', b: es ? `${cli} se registró con tu enlace.` : `${cli} signed up with your link.` },
      first_paid: { t: es ? '💳 ¡Primer pago!' : '💳 First payment!', b: es ? `${cli} hizo su primer pago. Empiezas a cobrar comisión.` : `${cli} made their first payment. Your commission starts.` },
      commission: { t: es ? '💰 Comisión ganada' : '💰 Commission earned', b: es ? `Ganaste ${amt} de comisión.` : `You earned ${amt} in commission.` },
      payout: { t: es ? '✅ Pago enviado' : '✅ Payout sent', b: es ? `Te pagamos ${amt}. Revisa tu método de cobro.` : `We paid you ${amt}. Check your payout method.` },
    };
    const m = M[ev];
    const url = '/dashboard/ventas';

    try { await notify(uid, { kind: 'info', title: m.t, body: m.b, url }); } catch { /* opcional */ }
    if (p?.email) { try { await sendEmail(p.email, m.t, `${m.b}\n\n${APP_URL}${url}`); } catch { /* opcional */ } }
    if (p?.telegram_chat_id && p.tg_alerts !== false) {
      try { await sendMessage(p.telegram_chat_id, `${m.t}\n\n${m.b}`, { kind: 'sales', userId: uid }); } catch { /* opcional */ }
    }
  } catch { /* nunca romper por un aviso */ }
}
