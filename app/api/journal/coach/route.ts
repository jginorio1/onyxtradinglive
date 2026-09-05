import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { pickLang } from '@/lib/i18n';
import { tradeInsight, type TradeInsightInput } from '@/lib/coachAI';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · Coach por operación. Recibe el trade_id (para validar que es suyo) y
// los datos ya documentados en la ficha; devuelve UNA línea de análisis del
// proceso. Gateado por la capacidad "coach". Nunca predice el mercado.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const b = await req.json().catch(() => ({} as any));
    const tradeId = String(b.trade_id || '').trim();
    if (!tradeId) return NextResponse.json({ error: 'Missing trade.', code: 'missing_data' }, { status: 400 });

    // La operación tiene que ser suya (trade → cuenta → user_id).
    const { data: tr } = await supabaseAdmin.from('trades').select('account_id').eq('id', tradeId).maybeSingle();
    const accId = (tr as any)?.account_id;
    let own = false;
    if (accId) {
      const { data: acc } = await supabaseAdmin.from('trading_accounts').select('id').eq('id', accId).eq('user_id', user.id).maybeSingle();
      own = !!acc;
    }
    if (!own) return NextResponse.json({ error: 'Trade not found.', code: 'not_found' }, { status: 404 });

    // Gating por plan (misma capacidad que el coach del dashboard).
    const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
    const planId = (prof as any)?.plan || 'free';
    const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', planId).maybeSingle();
    if (!((plan?.capabilities as any) || {}).coach) return NextResponse.json({ locked: true });

    const lang = pickLang(b.lang);
    const clamp = (a: any) => (Array.isArray(a) ? a.map((x) => String(x || '').slice(0, 40)).filter(Boolean).slice(0, 8) : undefined);
    const input: TradeInsightInput = {
      symbol: String(b.symbol || '').slice(0, 24), side: String(b.side || '').slice(0, 8),
      net: Number(b.net) || 0,
      grade: b.grade ? String(b.grade).slice(0, 2) : undefined,
      planFollowed: b.planFollowed ? String(b.planFollowed).slice(0, 10) : undefined,
      emotion: b.emotion ? String(b.emotion).slice(0, 40) : undefined,
      setups: clamp(b.setups), markets: clamp(b.markets), errors: clamp(b.errors),
      rMultiple: (b.rMultiple == null || !isFinite(Number(b.rMultiple))) ? null : Number(b.rMultiple),
      durationMin: (b.durationMin == null || !isFinite(Number(b.durationMin))) ? null : Number(b.durationMin),
      session: b.session ? String(b.session).slice(0, 16) : undefined,
    };
    const r = await tradeInsight(input, lang);
    return NextResponse.json({ ok: true, text: r.text });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
