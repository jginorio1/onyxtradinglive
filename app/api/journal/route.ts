import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · todas las entradas de diario del usuario (para pintar indicadores y filtros)
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const { data } = await supabaseAdmin.from('trade_journal').select('*').eq('user_id', user.id);
  return NextResponse.json({ entries: data || [] });
}

// POST · crear o actualizar la entrada de diario de una operación
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const b = await req.json();
  if (!b.trade_id) return NextResponse.json({ error: 'falta trade_id' }, { status: 400 });

  const row: any = { user_id: user.id, trade_id: b.trade_id, updated_at: new Date().toISOString() };
  if (b.notes !== undefined) row.notes = b.notes;
  if (b.tags !== undefined) row.tags = Array.isArray(b.tags) ? b.tags : [];
  if (b.emotion !== undefined) row.emotion = b.emotion;
  if (b.image_url !== undefined) row.image_url = b.image_url;

  const { error } = await supabaseAdmin.from('trade_journal').upsert(row, { onConflict: 'trade_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
