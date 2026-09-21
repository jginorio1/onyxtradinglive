import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { saveSetting, blogAuthorsSettings, type BlogAuthors, type BlogAuthorProfile } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const rid = () => 'a' + Math.random().toString(36).slice(2, 8);
const s = (v: any, n: number) => (v == null ? '' : String(v).slice(0, n));

// GET · plantel de autores del blog.
export async function GET() {
  const { ok } = await requirePerm('modulos', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  return NextResponse.json(await blogAuthorsSettings());
}

// PATCH · guardar el plantel (lista + autor por defecto).
export async function PATCH(req: Request) {
  const { ok } = await requirePerm('modulos', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const inc: any[] = Array.isArray(b.list) ? b.list : [];
  const list: BlogAuthorProfile[] = inc.slice(0, 30).map((a) => ({
    id: s(a.id, 60) || rid(),
    name: s(a.name, 120) || 'Autor',
    trader_es: s(a.trader_es, 120), trader_en: s(a.trader_en, 120),
    experience_es: s(a.experience_es, 120), experience_en: s(a.experience_en, 120),
    bio_es: s(a.bio_es, 600), bio_en: s(a.bio_en, 600),
    avatar_url: /^https?:\/\//.test(String(a.avatar_url || '')) ? String(a.avatar_url).slice(0, 500) : '',
    url: /^https?:\/\//.test(String(a.url || '')) ? String(a.url).slice(0, 300) : '',
  }));
  if (!list.length) return NextResponse.json({ error: 'al menos un autor' }, { status: 400 });
  const defaultId = list.some((x) => x.id === b.defaultId) ? b.defaultId : list[0].id;
  const value: BlogAuthors = { list, defaultId };
  await saveSetting('blog_authors', value);
  return NextResponse.json({ ok: true, ...value });
}
