import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { listAllPosts, savePost, deletePost } from '@/lib/blog';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · todos los artículos (borradores, programados y publicados) para el editor.
export async function GET() {
  try {
    const { ok } = await requirePerm('modulos', 'view');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    return NextResponse.json({ posts: await listAllPosts() });
  } catch (e: any) {
    await logError('blog_list', e);
    return NextResponse.json({ error: e?.message || 'error', posts: [] }, { status: 500 });
  }
}

// POST · crear o actualizar un artículo (incluye estado y programación).
export async function POST(req: Request) {
  try {
    const { ok, user } = await requirePerm('modulos', 'manage');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const b = await req.json().catch(() => ({} as any));
    if (!b.title_es && !b.title_en) return NextResponse.json({ error: 'falta título' }, { status: 400 });
    const r = await savePost({ ...b, author: b.author || user?.email });
    await logAdmin(user?.email || '', 'blog_save', 'blog', { id: r.id, status: b.status });
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('blog_save', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// DELETE · borrar un artículo.
export async function DELETE(req: Request) {
  try {
    const { ok, user } = await requirePerm('modulos', 'manage');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const b = await req.json().catch(() => ({} as any));
    if (!b.id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
    await deletePost(String(b.id));
    await logAdmin(user?.email || '', 'blog_delete', 'blog', { id: b.id });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await logError('blog_delete', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
