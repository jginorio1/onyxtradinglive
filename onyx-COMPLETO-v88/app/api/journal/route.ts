import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const EMOTIONS = ['calm', 'fear', 'greed', 'revenge', 'fomo', 'confident', 'tired', ''];

// GET · todas las entradas de diario del usuario (para pintar indicadores y filtros)
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });
    const { data } = await supabaseAdmin.from('trade_journal').select('*').eq('user_id', user.id);
    return NextResponse.json({ entries: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}

// POST · crear o actualizar la entrada de diario de una operación
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const b = await req.json().catch(() => ({} as any));
    const tradeId = String(b.trade_id || '').trim();
    if (!tradeId) return NextResponse.json({ error: 'Missing trade.', code: 'missing_data' }, { status: 400 });

    // La operación tiene que ser suya. Sin esta comprobación cualquiera podría
    // sobrescribir el diario de otro usuario adivinando un id.
    const { data: own } = await supabaseAdmin
      .from('trades').select('id').eq('id', tradeId).eq('user_id', user.id).maybeSingle();
    if (!own) return NextResponse.json({ error: 'Trade not found.', code: 'not_found' }, { status: 404 });

    const row: any = { user_id: user.id, trade_id: tradeId, updated_at: new Date().toISOString() };
    if (b.notes !== undefined) row.notes = String(b.notes || '').slice(0, 4000);
    if (b.tags !== undefined) row.tags = Array.isArray(b.tags) ? b.tags.slice(0, 20).map((x: any) => String(x).slice(0, 40)) : [];
    if (b.emotion !== undefined) row.emotion = EMOTIONS.includes(b.emotion) ? b.emotion : null;
    if (b.image_url !== undefined) row.image_url = b.image_url ? String(b.image_url).slice(0, 500) : null;

    const { error } = await supabaseAdmin.from('trade_journal').upsert(row, { onConflict: 'trade_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
