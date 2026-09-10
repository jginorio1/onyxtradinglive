import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sellerEarnings } from '@/lib/botlab';
import { balances as ambBalances } from '@/lib/ambassadors';

// ============================================================
// CENTRO DE GANANCIAS · un solo lugar con TODOS los ingresos del usuario en la
// app, sin importar el programa. Solo LECTURA y agregación: cada programa
// conserva su propio motor, saldo y retiro. Cada bloque va en try/catch para que
// si a un usuario le falta una tabla o un programa, el resto siga funcionando.
//
// kind:
//   'withdraw' → dinero retirable: tú pides el retiro en su pantalla.
//   'credit'   → crédito en tu plan: se aplica solo a tu próxima factura.
//   'direct'   → se cobra directo a tu Stripe: ya es tuyo (informativo).
// ============================================================

export type EarnProgram = {
  key: string;
  es: string; en: string;
  descEs: string; descEn: string;
  icon: string;
  kind: 'withdraw' | 'credit' | 'direct';
  availableCents: number;
  pendingCents: number;
  paidCents: number;   // ya pagado / ya cobrado
  href: string;
};

export type EarningsCenter = {
  currency: string;
  totalAvailableCents: number;   // retirable ahora (kind 'withdraw')
  totalCreditCents: number;      // crédito por aplicar
  totalPendingCents: number;     // en espera (madurando) de los retirables
  totalPaidCents: number;        // histórico cobrado, todos los programas
  programs: EarnProgram[];
};

export async function earningsCenter(userId: string): Promise<EarningsCenter> {
  const programs: EarnProgram[] = [];

  // 1) BOT LAB · ventas de tus robots + afiliado (mismo bolsillo). Retirable USDT/banco.
  try {
    const e = await sellerEarnings(userId);
    programs.push({
      key: 'botlab', es: 'Bot Lab', en: 'Bot Lab',
      descEs: 'Ventas de tus robots y comisiones por referir robots de otros.',
      descEn: 'Sales of your robots plus commissions for referring others\' robots.',
      icon: '🤖', kind: 'withdraw',
      availableCents: e.availableCents || 0, pendingCents: e.pendingCents || 0, paidCents: e.paidCents || 0,
      href: '/dashboard/bot-lab?tab=ganancias',
    });
  } catch { /* sin Bot Lab */ }

  // 2) EMBAJADOR · comisión recurrente por suscriptores que traes. Retirable Stripe/crédito.
  try {
    const { data: amb } = await supabaseAdmin.from('ambassadors').select('id,status').eq('user_id', userId).maybeSingle();
    if (amb && (amb as any).status === 'approved') {
      const b = await ambBalances((amb as any).id);   // en dólares
      programs.push({
        key: 'ambassador', es: 'Embajador', en: 'Ambassador',
        descEs: 'Comisión recurrente por cada suscriptor que traes a Onyx.',
        descEn: 'Recurring commission for every subscriber you bring to Onyx.',
        icon: '📣', kind: 'withdraw',
        availableCents: Math.round((b.available || 0) * 100), pendingCents: Math.round((b.pending || 0) * 100), paidCents: Math.round((b.paid || 0) * 100),
        href: '/account?tab=retiros',
      });
    }
  } catch { /* sin programa de embajador */ }

  // 3) INVITA Y GANA · crédito en tu plan por referir miembros.
  try {
    const { data } = await supabaseAdmin.from('member_rewards').select('amount,status,available_at').eq('beneficiary', userId);
    const rows = (data || []) as any[];
    if (rows.length) {
      const now = Date.now();
      let av = 0, pe = 0, pa = 0;
      for (const r of rows) {
        const c = Math.round((Number(r.amount) || 0) * 100);
        if (r.status === 'applied' || r.status === 'credited' || r.status === 'paid') pa += c;
        else if (r.status === 'reversed') continue;
        else if (r.available_at && new Date(r.available_at).getTime() <= now) av += c;
        else pe += c;
      }
      programs.push({
        key: 'invite', es: 'Invita y gana', en: 'Invite & earn',
        descEs: 'Crédito en tu plan por cada amigo que se suscribe con tu enlace.',
        descEn: 'Plan credit for each friend who subscribes with your link.',
        icon: '🎁', kind: 'credit',
        availableCents: av, pendingCents: pe, paidCents: pa,
        href: '/dashboard',
      });
    }
  } catch { /* sin invita y gana */ }

  // 4) ACADEMIA · AFILIADO · comisión por traer alumnos a academias. Retirable (lo paga el mentor).
  try {
    const { data } = await supabaseAdmin.from('academy_reward_events').select('amount_cents,status').eq('referrer_id', userId);
    const rows = (data || []) as any[];
    if (rows.length) {
      let av = 0, pe = 0, pa = 0;
      for (const r of rows) {
        const c = Math.round(Number(r.amount_cents) || 0);
        if (r.status === 'paid') pa += c;
        else if (r.status === 'reversed') continue;
        else if (r.status === 'available') av += c;
        else pe += c;
      }
      programs.push({
        key: 'academy_ref', es: 'Academia · Afiliado', en: 'Academy · Affiliate',
        descEs: 'Comisión por traer alumnos a las academias de otros mentores.',
        descEn: 'Commission for bringing students to other mentors\' academies.',
        icon: '🎓', kind: 'withdraw',
        availableCents: av, pendingCents: pe, paidCents: pa,
        href: '/dashboard/academy',
      });
    }
  } catch { /* sin afiliado de academia */ }

  // 5) ACADEMIA · MENTOR · vendes cursos/membresías. Se cobra directo a tu Stripe.
  try {
    const { data: m } = await supabaseAdmin.from('mentors').select('id').eq('user_id', userId).maybeSingle();
    if (m) {
      const { data } = await supabaseAdmin.from('onyx_commissions').select('gross_cents,fee_cents').eq('mentor_id', (m as any).id).neq('status', 'reversed');
      const net = (data || []).reduce((s: number, r: any) => s + ((r.gross_cents || 0) - (r.fee_cents || 0)), 0);
      if (net > 0) {
        programs.push({
          key: 'academy_mentor', es: 'Academia · Mentor', en: 'Academy · Mentor',
          descEs: 'Venta de tus cursos y membresías. Se deposita directo en tu Stripe.',
          descEn: 'Your course and membership sales. Paid straight to your Stripe.',
          icon: '🏫', kind: 'direct',
          availableCents: 0, pendingCents: 0, paidCents: net,
          href: '/dashboard/academy',
        });
      }
    }
  } catch { /* sin academia de mentor */ }

  // 6) ONYX COPY · proveedor · cobras a quienes copian tu estrategia. Directo a tu Stripe.
  try {
    const { data: provs } = await supabaseAdmin.from('strategy_providers').select('id').eq('user_id', userId);
    const ids = (provs || []).map((p: any) => p.id);
    if (ids.length) {
      const [sub, perf] = await Promise.all([
        supabaseAdmin.from('copy_follow_commissions').select('net_cents').in('provider_id', ids),
        supabaseAdmin.from('copy_perf_charges').select('net_cents,status').in('provider_id', ids).eq('status', 'charged'),
      ]);
      const net = ((sub.data || []).reduce((s: number, r: any) => s + (r.net_cents || 0), 0))
        + ((perf.data || []).reduce((s: number, r: any) => s + (r.net_cents || 0), 0));
      if (net > 0) {
        programs.push({
          key: 'copy', es: 'Onyx Copy', en: 'Onyx Copy',
          descEs: 'Cobras a quienes copian tu estrategia. Se deposita directo en tu Stripe.',
          descEn: 'You charge those who copy your strategy. Paid straight to your Stripe.',
          icon: '🏆', kind: 'direct',
          availableCents: 0, pendingCents: 0, paidCents: net,
          href: '/dashboard/onyx-copy',
        });
      }
    }
  } catch { /* sin Onyx Copy */ }

  const totalAvailableCents = programs.filter((p) => p.kind === 'withdraw').reduce((s, p) => s + p.availableCents, 0);
  const totalCreditCents = programs.filter((p) => p.kind === 'credit').reduce((s, p) => s + p.availableCents + p.pendingCents, 0);
  const totalPendingCents = programs.filter((p) => p.kind === 'withdraw').reduce((s, p) => s + p.pendingCents, 0);
  const totalPaidCents = programs.reduce((s, p) => s + p.paidCents, 0);

  return { currency: 'USD', totalAvailableCents, totalCreditCents, totalPendingCents, totalPaidCents, programs };
}
