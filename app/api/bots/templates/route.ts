import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cleanSpec, type BotSpec } from '@/lib/botSpec';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · lista mis plantillas de bot.
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    const { data } = await supabaseAdmin.from('bot_templates').select('id,name,spec,created_at,updated_at').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(100);
    return NextResponse.json({ templates: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// POST · guardar la receta actual como plantilla (o actualizar por id).
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    const b = await req.json().catch(() => ({}));
    const spec: BotSpec = cleanSpec(b.spec || b);
    const name = String(b.name || spec.name || 'Plantilla').slice(0, 60).trim() || 'Plantilla';
    const id = b.id ? String(b.id) : '';
    const row: any = { user_id: user.id, name, spec, updated_at: new Date().toISOString() };
    if (id) {
      const { error } = await supabaseAdmin.from('bot_templates').update(row).eq('id', id).eq('user_id', user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, id });
    }
    const { data, error } = await supabaseAdmin.from('bot_templates').insert(row).select('id').single();
    if (error || !data) return NextResponse.json({ error: error?.message || 'error' }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// DELETE · borrar una plantilla.
export async function DELETE(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
    await supabaseAdmin.from('bot_templates').delete().eq('id', id).eq('user_id', user.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
