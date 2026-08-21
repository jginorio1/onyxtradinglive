import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET público · ranking de traders calificados. Devuelve SOLO campos seguros
// (nunca login, cuenta ni fondos). Ordenado por Onyx Score. Filtro ?tier=.
export async function GET(req: Request) {
  try {
    const tier = new URL(req.url).searchParams.get('tier') || '';
    let q = supabaseAdmin.from('strategy_providers')
      .select('id,display_name,avatar_url,tier,score,pillars,stats,style_note,followers,fee_month,perf_fee_pct,verified,scored_at')
      .eq('listed', true).eq('status', 'active').neq('tier', 'none')
      .order('score', { ascending: false }).limit(100);
    if (['silver', 'gold', 'diamond'].includes(tier)) q = q.eq('tier', tier);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, providers: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
