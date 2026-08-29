import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cleanSpec, toSetFile, summarize, type BotSpec } from '@/lib/botSpec';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · lista mis bots construidos, o descarga el .set de uno (?download=<id>&lang=es).
export async function GET(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

    const url = new URL(req.url);
    const dl = url.searchParams.get('download');
    if (dl) {
      const { data: bot } = await supabaseAdmin.from('bots_built').select('*').eq('id', dl).eq('user_id', user.id).maybeSingle();
      if (!bot) return NextResponse.json({ error: 'no encontrado' }, { status: 404 });
      const spec = cleanSpec((bot as any).spec);
      const set = toSetFile(spec);
      const fname = (spec.name || 'bot').replace(/[^\w.\- ]+/g, '_').slice(0, 40) + '.set';
      return new NextResponse(set, { headers: { 'content-type': 'text/plain; charset=utf-8', 'content-disposition': `attachment; filename="${fname}"` } });
    }

    const { data } = await supabaseAdmin.from('bots_built').select('id,name,platform,magic,spec,created_at,updated_at').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(100);
    return NextResponse.json({ bots: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// POST · crear o actualizar una receta de bot (spec). Devuelve el resumen legible.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

    const b = await req.json().catch(() => ({}));
    const id = b.id ? String(b.id) : '';
    const spec: BotSpec = cleanSpec(b.spec || b);
    const lang = b.lang === 'en' ? 'en' : 'es';

    const row: any = { user_id: user.id, name: spec.name, platform: spec.platform, magic: spec.magic, spec, updated_at: new Date().toISOString() };

    if (id) {
      const { error } = await supabaseAdmin.from('bots_built').update(row).eq('id', id).eq('user_id', user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, id, summary: summarize(spec, lang === 'en') });
    }
    const { data, error } = await supabaseAdmin.from('bots_built').insert(row).select('id').single();
    if (error || !data) return NextResponse.json({ error: error?.message || 'error' }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id, summary: summarize(spec, lang === 'en') });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// DELETE · borrar una receta.
export async function DELETE(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
    await supabaseAdmin.from('bots_built').delete().eq('id', id).eq('user_id', user.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
