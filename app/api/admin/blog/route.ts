import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { listAllPosts, savePost, deletePost } from '@/lib/blog';
import { sendBlogEmailNow } from '@/lib/blogEmail';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
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

    // Envío por email a la base de datos, si el dueño lo activó en el editor.
    //  · 'now'      → sale ya mismo.
    //  · 'publish'  → sale ahora solo si el artículo quedó publicado (si es programado,
    //                 saldrá cuando el cron lo publique).
    //  · 'schedule' → sale ahora solo si la fecha del email ya pasó (si no, la envía el cron).
    let emailed: { count: number; sent: number } | null = null;
    if (b.email_enabled) {
      try {
        const { data: post } = await supabaseAdmin.from('blog_posts').select('*').eq('id', r.id).maybeSingle();
        const p: any = post || {};
        const when = p.email_when || b.email_when || 'publish';
        const dueNow = when === 'now'
          || (when === 'publish' && p.status === 'published')
          || (when === 'schedule' && p.email_at && new Date(p.email_at).getTime() <= Date.now());
        if (dueNow && !p.email_sent_at) emailed = await sendBlogEmailNow(p, p.email_segment || b.email_segment || 'all');
      } catch (e) { await logError('blog_email_onsave', e); }
    }

    await logAdmin(user?.email || '', 'blog_save', 'blog', { id: r.id, status: b.status, emailed: emailed?.sent || 0 });
    return NextResponse.json({ ok: true, ...r, emailed });
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
