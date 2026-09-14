import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { staffByUser } from '@/lib/payroll';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · panel del empleado: su ficha, método de cobro, estado Connect e historial.
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const st = await staffByUser(user.id);
  if (!st) return NextResponse.json({ isStaff: false });

  let connect = { connected: false, payoutsEnabled: false };
  try { const { staffConnectStatus } = await import('@/lib/payrollPayout'); connect = await staffConnectStatus(st.id); } catch {}
  const { data: payments } = await supabaseAdmin.from('staff_payments')
    .select('period,amount,currency,method,status,ref,paid_at,created_at').eq('staff_id', st.id).order('created_at', { ascending: false }).limit(60);

  return NextResponse.json({
    isStaff: true,
    staff: {
      id: st.id, name: st.name, department: st.department, position: st.position,
      salary: st.salary, currency: st.currency, payout_method: st.payout_method, status: st.status,
      start_date: st.start_date,
    },
    connect,
    wallets: { trc20: st.payout_usdt_trc20 || '', erc20: st.payout_usdt_erc20 || '', network: st.payout_usdt_network || 'trc20' },
    payments: payments || [],
  });
}

// POST · el empleado conecta su cobro o guarda su método.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const st = await staffByUser(user.id);
  if (!st) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const action = String(b.action || '');

  try {
    if (action === 'connect_link') {
      const { staffOnboardingLink } = await import('@/lib/payrollPayout');
      const url = await staffOnboardingLink(st.id, user.id, user.email || undefined);
      return NextResponse.json({ ok: true, url });
    }
    if (action === 'save_payout') {
      const patch: any = {};
      if (['stripe', 'usdt', 'manual'].includes(b.payout_method)) patch.payout_method = b.payout_method;
      if (b.payout_method === 'usdt' && b.wallet && b.network) {
        const { validateWallet } = await import('@/lib/payoutProfile');
        const net = b.network === 'erc20' ? 'erc20' : 'trc20';
        const v = validateWallet(net, String(b.wallet));
        if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
        patch[net === 'erc20' ? 'payout_usdt_erc20' : 'payout_usdt_trc20'] = String(b.wallet).trim();
        patch.payout_usdt_network = net;
      }
      if (Object.keys(patch).length) await supabaseAdmin.from('staff').update(patch).eq('id', st.id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
