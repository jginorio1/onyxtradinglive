import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Base de conocimiento editable que lee Onyx AI (gestión: permiso de Soporte).
export async function GET() {
  try {
    const { ok } = await requirePerm('soporte', 'view');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const { data } = await supabaseAdmin.from('kb_articles').select('*').order('updated_at', { ascending: false });
    return NextResponse.json({ articles: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { ok, user } = await requirePerm('soporte', 'manage');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const b = await req.json();
    const title = String(b.title || '').trim().slice(0, 160);
    const body = String(b.body || '').trim().slice(0, 8000);
    if (!title || !body) return NextResponse.json({ error: 'faltan datos', code: 'missing' }, { status: 400 });
    const { error } = await supabaseAdmin.from('kb_articles').insert({ title, body, tags: String(b.tags || '').slice(0, 300), published: b.published !== false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAdmin(user?.email || '', 'kb_add', title, {});
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { ok, user } = await requirePerm('soporte', 'manage');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const b = await req.json();
    if (!b.id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
    const patch: any = { updated_at: new Date().toISOString() };
    if (b.title !== undefined) patch.title = String(b.title).slice(0, 160);
    if (b.body !== undefined) patch.body = String(b.body).slice(0, 8000);
    if (b.tags !== undefined) patch.tags = String(b.tags).slice(0, 300);
    if (b.published !== undefined) patch.published = !!b.published;
    const { error } = await supabaseAdmin.from('kb_articles').update(patch).eq('id', b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAdmin(user?.email || '', 'kb_edit', b.id, {});
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { ok, user } = await requirePerm('soporte', 'manage');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const { id } = await req.json();
    await supabaseAdmin.from('kb_articles').delete().eq('id', id);
    await logAdmin(user?.email || '', 'kb_delete', id, {});
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
