import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GRADES = ['A', 'B', 'C', ''];
const PLAN = ['yes', 'partial', 'no', ''];

// Limpia una lista de tags (texto corto, sin vacíos, tope de cantidad).
function cleanTags(v: any, max = 20): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x || '').trim().slice(0, 40)).filter(Boolean).slice(0, max);
}

// GET · entradas de diario del usuario + sus tags personalizados.
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });
    const [{ data: entries }, { data: prof }] = await Promise.all([
      supabaseAdmin.from('trade_journal').select('*').eq('user_id', user.id),
      supabaseAdmin.from('profiles').select('journal_tags').eq('id', user.id).maybeSingle(),
    ]);
    const jt = (prof?.journal_tags && typeof prof.journal_tags === 'object') ? prof.journal_tags : {};
    const customTags = {
      setups: cleanTags((jt as any).setups, 40),
      emotions: cleanTags((jt as any).emotions, 40),
      markets: cleanTags((jt as any).markets, 40),
      errors: cleanTags((jt as any).errors, 40),
    };
    return NextResponse.json({ entries: entries || [], customTags });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}

// POST · crear o actualizar la entrada de diario de una operación.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const b = await req.json().catch(() => ({} as any));
    const tradeId = String(b.trade_id || '').trim();
    if (!tradeId) return NextResponse.json({ error: 'Missing trade.', code: 'missing_data' }, { status: 400 });

    // La operación tiene que ser suya. OJO: la tabla `trades` NO tiene user_id
    // (se ata a la cuenta, no al usuario). Antes se comprobaba trades.user_id,
    // columna inexistente → SIEMPRE daba "not found" y no se podía guardar nada.
    // Ahora se valida por la cadena trade → cuenta → user_id.
    const { data: tr } = await supabaseAdmin
      .from('trades').select('account_id').eq('id', tradeId).maybeSingle();
    const accId = (tr as any)?.account_id;
    let own = false;
    if (accId) {
      const { data: acc } = await supabaseAdmin
        .from('trading_accounts').select('id').eq('id', accId).eq('user_id', user.id).maybeSingle();
      own = !!acc;
    }
    if (!own) return NextResponse.json({ error: 'Trade not found.', code: 'not_found' }, { status: 404 });

    // Quitar del diario: borra la entrada completa para que la operación vuelva a
    // "sin documentar" (se usa al desmarcar todo o desde el botón "Quitar del diario").
    if (b.clear === true) {
      const { error } = await supabaseAdmin.from('trade_journal').delete().eq('trade_id', tradeId).eq('user_id', user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, cleared: true });
    }

    const row: any = { user_id: user.id, trade_id: tradeId, updated_at: new Date().toISOString() };
    if (b.notes !== undefined) row.notes = String(b.notes || '').slice(0, 4000);
    if (b.tags !== undefined) row.tags = cleanTags(b.tags);
    // Emoción: antes se limitaba a una lista fija en inglés, así que las emociones
    // reales de la UI (y las personalizadas) se perdían. Ahora se acepta cualquier
    // texto corto, para que los tags propios del trader se guarden.
    if (b.emotion !== undefined) row.emotion = b.emotion ? String(b.emotion).slice(0, 40) : null;
    if (b.image_url !== undefined) row.image_url = b.image_url ? String(b.image_url).slice(0, 500) : null;
    if (b.image_url_exit !== undefined) row.image_url_exit = b.image_url_exit ? String(b.image_url_exit).slice(0, 500) : null;
    if (b.grade !== undefined) row.grade = GRADES.includes(b.grade) ? (b.grade || null) : null;
    if (b.plan_followed !== undefined) row.plan_followed = PLAN.includes(b.plan_followed) ? (b.plan_followed || null) : null;
    if (b.market_tags !== undefined) row.market_tags = cleanTags(b.market_tags);
    if (b.error_tags !== undefined) row.error_tags = cleanTags(b.error_tags);
    // Riesgo $ del trade (opcional). Vacío o inválido → null; nunca negativo.
    if (b.risk_amount !== undefined) { const n = Number(b.risk_amount); row.risk_amount = (b.risk_amount === '' || b.risk_amount == null || !isFinite(n) || n < 0) ? null : Math.min(n, 1e9); }

    const { error } = await supabaseAdmin.from('trade_journal').upsert(row, { onConflict: 'trade_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
