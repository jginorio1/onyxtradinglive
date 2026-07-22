import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ambSettings, rateFor, balances, codeFromEmail } from '@/lib/ambassadors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · el panel del embajador (o el estado de su solicitud)
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const settings = await ambSettings();
    const { data: amb } = await supabaseAdmin.from('ambassadors').select('*').eq('user_id', user.id).maybeSingle();
    if (!amb) return NextResponse.json({ settings, ambassador: null });

    const { rate, tier, active } = await rateFor(amb, settings);
    const bal = await balances(amb.id);

    const { count: clicks } = await supabaseAdmin.from('ref_clicks').select('*', { count: 'exact', head: true }).eq('code', amb.code);
    const { count: signups } = await supabaseAdmin.from('referrals').select('*', { count: 'exact', head: true }).eq('ambassador_id', amb.id);
    const { data: pays } = await supabaseAdmin.from('ambassador_payouts').select('id,amount,method,status,requested_at,paid_at').eq('ambassador_id', amb.id).order('requested_at', { ascending: false }).limit(20);
    const { data: recent } = await supabaseAdmin.from('commissions').select('amount,currency,status,created_at,available_at').eq('ambassador_id', amb.id).order('created_at', { ascending: false }).limit(20);

    return NextResponse.json({
      settings,
      ambassador: {
        code: amb.code, status: amb.status, payout_method: amb.payout_method, payout_details: amb.payout_details,
        rate, tier, active, clicks: clicks || 0, signups: signups || 0,
      },
      balances: bal,
      payouts: pays || [],
      commissions: recent || [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// POST · enviar la solicitud para ser embajador
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const settings = await ambSettings();
    if (!settings.enabled) return NextResponse.json({ error: 'Program closed.', code: 'closed' }, { status: 400 });

    const { data: prev } = await supabaseAdmin.from('ambassadors').select('id').eq('user_id', user.id).maybeSingle();
    if (prev) return NextResponse.json({ error: 'Already applied.', code: 'already_applied' }, { status: 400 });

    const b = await req.json().catch(() => ({} as any));

    // Datos obligatorios de la solicitud
    const audience = String(b.audience || '').trim();
    const details = String(b.payout_details || '').trim();
    if (audience.length < 10) return NextResponse.json({ error: 'Tell us about your community.', code: 'need_audience' }, { status: 400 });
    if (details.length < 4) return NextResponse.json({ error: 'Payout details required.', code: 'need_details' }, { status: 400 });

    let code = String(b.code || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20);
    if (code.length < 3) code = codeFromEmail(user.email || '');

    const { data: taken } = await supabaseAdmin.from('ambassadors').select('id').eq('code', code).maybeSingle();
    if (taken) return NextResponse.json({ error: 'Code taken.', code: 'code_taken' }, { status: 400 });

    const { error } = await supabaseAdmin.from('ambassadors').insert({
      user_id: user.id,
      code,
      status: 'pending',
      audience: String(b.audience || '').slice(0, 300),
      followers: b.followers ? Number(String(b.followers).replace(/\D/g, '')) || null : null,
      payout_method: ['paypal', 'usdt', 'credit'].includes(b.payout_method) ? b.payout_method : 'paypal',
      payout_details: String(b.payout_details || '').slice(0, 200),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, code });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// PATCH · actualizar sus datos de cobro
export async function PATCH(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });
    const b = await req.json().catch(() => ({} as any));
    const fields: any = {};
    if (b.payout_method && ['paypal', 'usdt', 'credit'].includes(b.payout_method)) fields.payout_method = b.payout_method;
    if (b.payout_details !== undefined) {
      const d = String(b.payout_details).trim();
      // Los datos de cobro no pueden quedarse vacios: sin ellos no podemos pagarle.
      if (d.length < 4) return NextResponse.json({ error: 'Payout details required.', code: 'need_details' }, { status: 400 });
      fields.payout_details = d.slice(0, 200);
    }
    if (!Object.keys(fields).length) return NextResponse.json({ ok: true });
    const { error } = await supabaseAdmin.from('ambassadors').update(fields).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
