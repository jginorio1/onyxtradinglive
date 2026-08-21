import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · cobros del trader calificado: seguidores activos y ganancias por copia.
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado', code: 'no_auth' }, { status: 401 });

    const { data: provs } = await supabaseAdmin.from('strategy_providers').select('id,display_name,tier,followers,fee_month').eq('user_id', user.id);
    const ids = (provs || []).map((p: any) => p.id);
    let net = 0, gross = 0, fee = 0; let rows: any[] = [];
    if (ids.length) {
      const { data: comm } = await supabaseAdmin.from('copy_follow_commissions')
        .select('provider_id,gross_cents,fee_cents,net_cents,currency,created_at').in('provider_id', ids).order('created_at', { ascending: false }).limit(200);
      rows = comm || [];
      for (const c of rows) { gross += c.gross_cents || 0; fee += c.fee_cents || 0; net += c.net_cents || 0; }
    }
    return NextResponse.json({ ok: true, providers: provs || [], totals: { gross_cents: gross, fee_cents: fee, net_cents: net }, recent: rows.slice(0, 30) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
