import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · ficha del trader detrás de un ticket: plan, cuentas MT, fondeo,
// miembro desde, tickets previos e idioma. Se carga al abrir la conversación,
// por eso va aparte del GET principal (que se refresca cada pocos segundos).
export async function GET(req: Request) {
  try {
    const { ok } = await requirePerm('soporte', 'view');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    const ticketId = new URL(req.url).searchParams.get('ticket_id') || '';
    if (!ticketId) return NextResponse.json({ error: 'falta ticket', code: 'missing' }, { status: 400 });

    const { data: tk } = await supabaseAdmin
      .from('support_tickets')
      .select('id,user_id,email,is_lead,created_at')
      .eq('id', ticketId).maybeSingle();
    if (!tk) return NextResponse.json({ error: 'ticket no existe', code: 'notfound' }, { status: 404 });

    const email = (tk as any).email || '';
    let userId = (tk as any).user_id || null;

    // Si es un lead sin cuenta, intentamos emparejarlo por correo con un perfil existente
    if (!userId && email) {
      const { data: byMail } = await supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle();
      if (byMail) userId = (byMail as any).id;
    }

    let profile: any = null;
    let accounts = 0;
    let funded = 0;
    if (userId) {
      const { data: p } = await supabaseAdmin
        .from('profiles')
        .select('full_name,plan,created_at,lang,country,prop_firm')
        .eq('id', userId).maybeSingle();
      profile = p || null;

      const { data: accs } = await supabaseAdmin
        .from('trading_accounts')
        .select('acc_type')
        .eq('user_id', userId);
      accounts = (accs || []).length;
      funded = (accs || []).filter((a: any) => a.acc_type === 'funded' || a.acc_type === 'challenge').length;
    }

    // Tickets previos de esta persona (por cuenta o por correo), sin contar el actual
    let priorTickets = 0;
    try {
      if (userId) {
        const { count } = await supabaseAdmin.from('support_tickets')
          .select('*', { count: 'exact', head: true }).eq('user_id', userId).neq('id', ticketId);
        priorTickets = count || 0;
      } else if (email) {
        const { count } = await supabaseAdmin.from('support_tickets')
          .select('*', { count: 'exact', head: true }).eq('email', email).neq('id', ticketId);
        priorTickets = count || 0;
      }
    } catch {}

    return NextResponse.json({
      email,
      user_id: userId,
      is_lead: !!(tk as any).is_lead && !profile,
      name: profile?.full_name || null,
      plan: profile?.plan || null,
      member_since: profile?.created_at || null,
      lang: profile?.lang || null,
      country: profile?.country || null,
      prop_firm: profile?.prop_firm && profile.prop_firm !== 'ninguna' ? profile.prop_firm : null,
      accounts,
      funded,
      prior_tickets: priorTickets,
      first_seen: (tk as any).created_at || null,
    });
  } catch (e: any) {
    await logError('support_context', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
