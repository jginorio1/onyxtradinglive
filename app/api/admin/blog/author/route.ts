import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { saveSetting } from '@/lib/settings';
import { blogAuthorSettings, type BlogAuthor } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET/PATCH · autor del blog (firma E-E-A-T + schema).
export async function GET() {
  const { ok } = await requirePerm('modulos', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  return NextResponse.json(await blogAuthorSettings());
}

export async function PATCH(req: Request) {
  const { ok } = await requirePerm('modulos', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const prev = await blogAuthorSettings();
  const b = await req.json().catch(() => ({} as any));
  const s = (v: any, n: number, fb: string) => (v == null ? fb : String(v).slice(0, n));
  const value: BlogAuthor = {
    name: s(b.name, 120, prev.name) || 'Equipo Onyx',
    role_es: s(b.role_es, 160, prev.role_es), role_en: s(b.role_en, 160, prev.role_en),
    bio_es: s(b.bio_es, 600, prev.bio_es), bio_en: s(b.bio_en, 600, prev.bio_en),
    avatar_url: /^https?:\/\//.test(String(b.avatar_url || '')) ? String(b.avatar_url).slice(0, 500) : (b.avatar_url === '' ? '' : prev.avatar_url),
    url: /^https?:\/\//.test(String(b.url || '')) ? String(b.url).slice(0, 300) : (b.url === '' ? '' : prev.url),
  };
  await saveSetting('blog_author', value);
  return NextResponse.json({ ok: true, ...value });
}
