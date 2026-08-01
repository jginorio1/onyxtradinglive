import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendMessage } from '@/lib/telegram';
import { sendEmail } from '@/lib/mail';
import { sendPush } from '@/lib/push';

// ============================================================
// Cambio de plan: avisos + aplicación de límites al bajar de plan.
//
// La regla de oro: bajar de plan no quita nada al instante. Solo cuando el
// periodo pagado expira (corte) llamamos enforcePlanLimits(), que pausa —sin
// borrar— lo que sobra. Si el trader vuelve a subir, se reactiva.
// ============================================================

type BiText = { es: string; en: string };

// Aviso de facturación: correo siempre + Telegram si lo tiene vinculado.
// No depende de la capacidad "telegram" del plan (un aviso de cobro debe llegar
// aunque el plan nuevo ya no incluya Telegram).
export async function notifyPlanChange(userId: string, subject: BiText, body: BiText) {
  try {
    const { data: p } = await supabaseAdmin.from('profiles')
      .select('email,lang,telegram_chat_id,tg_alerts,tg_billing').eq('id', userId).maybeSingle() as any;
    if (!p) return;
    const lang: 'es' | 'en' = p.lang === 'es' ? 'es' : 'en';
    if (p.email) { try { await sendEmail(p.email, subject[lang], body[lang]); } catch { /* mailer opcional */ } }
    if (p.telegram_chat_id && p.tg_alerts !== false && p.tg_billing !== false) {
      try { await sendMessage(p.telegram_chat_id, `💳 ${subject[lang]}\n\n${body[lang]}`, { kind: 'billing', userId }); } catch { /* opcional */ }
    }
    try { await sendPush(userId, { title: subject[lang], body: body[lang], url: '/account' }); } catch { /* push opcional */ }
  } catch { /* nunca romper el flujo por un aviso */ }
}

// Orden de planes por precio (para saber si un cambio es subir o bajar).
export async function planRank(): Promise<Record<string, number>> {
  const { data } = await supabaseAdmin.from('plans').select('id,price_month').order('price_month', { ascending: true });
  const r: Record<string, number> = {};
  (data || []).forEach((p: any, i: number) => { r[p.id] = i; });
  return r;
}

// Aplica los límites del plan `newPlanId` al usuario: pausa cuentas MT que
// sobran (respetando la elección del trader en profiles.pending_keep) y pausa
// el copy si el plan nuevo no lo incluye. Nada se borra.
export async function enforcePlanLimits(userId: string, newPlanId: string) {
  const { data: plan } = await supabaseAdmin.from('plans')
    .select('max_accounts,capabilities').eq('id', newPlanId).maybeSingle();
  const base = Number(plan?.max_accounts ?? 1);
  const unlimited = base >= 999;
  const caps: any = plan?.capabilities || {};

  const { data: prof } = await supabaseAdmin.from('profiles').select('pending_keep').eq('id', userId).maybeSingle();
  const keepPref: string[] = Array.isArray((prof as any)?.pending_keep) ? (prof as any).pending_keep.map(String) : [];

  const { data: accs } = await supabaseAdmin.from('trading_accounts')
    .select('id,created_at').eq('user_id', userId).order('created_at', { ascending: true });
  const all = accs || [];

  let keepIds: Set<string>;
  if (unlimited || all.length <= base) {
    keepIds = new Set(all.map((a: any) => String(a.id)));   // caben todas → ninguna pausada
  } else {
    // Primero las que el trader eligió conservar (válidas), luego las más antiguas.
    const chosen = keepPref.filter((id) => all.some((a: any) => String(a.id) === id)).slice(0, base);
    keepIds = new Set(chosen);
    for (const a of all) { if (keepIds.size >= base) break; keepIds.add(String(a.id)); }
  }

  for (const a of all) {
    const keep = keepIds.has(String(a.id));
    await supabaseAdmin.from('trading_accounts').update({ plan_paused: !keep }).eq('id', a.id);
  }

  // Copy: si el plan nuevo no lo incluye, pausa global (kill switch). No borra enlaces.
  if (!caps.copy) {
    await supabaseAdmin.from('profiles').update({ copy_paused: true, copy_paused_at: new Date().toISOString() }).eq('id', userId);
  }
}
