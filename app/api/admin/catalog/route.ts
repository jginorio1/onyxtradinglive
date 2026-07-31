import { NextResponse } from 'next/server';
import { getAdmin, logAdmin, requirePerm } from '@/lib/admin';
import { getSetting, saveSetting } from '@/lib/settings';
import { CATALOG_DEFAULTS, catalogKey, isCatalogKind, type CatalogItem } from '@/lib/catalogDefaults';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Admin: gestiona los catálogos (países, plataformas, tipos de trader, firms/brokers).
// GET ?kind=  -> lista actual (guardada o por defecto) + isDefault
// POST { kind, items } -> guarda la lista
// POST { kind, action:'reset' } -> vuelve a los valores por defecto

export async function GET(req: Request) {
  const _p = await requirePerm('catalogos', 'view');
  if (!_p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const kind = new URL(req.url).searchParams.get('kind') || '';
  if (!isCatalogKind(kind)) return NextResponse.json({ error: 'kind inválido' }, { status: 400 });
  const s = await getSetting<{ items: CatalogItem[] }>(catalogKey(kind), { items: [] });
  const saved = !!s?.items?.length;
  return NextResponse.json({ items: saved ? s.items : CATALOG_DEFAULTS[kind], isDefault: !saved });
}

function clean(items: any[]): CatalogItem[] {
  return (Array.isArray(items) ? items : []).slice(0, 500).map((it: any) => {
    const es = String(it.es || '').trim().slice(0, 80);
    let code = String(it.code || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
    if (!code) code = es.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
    return { code, es, en: String(it.en || it.es || '').trim().slice(0, 80) };
  }).filter((it) => it.code && it.es);
}

export async function POST(req: Request) {
  const _p = await requirePerm('catalogos', 'manage');
  if (!_p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const { user } = await getAdmin();
  const b = await req.json().catch(() => ({} as any));
  const kind = String(b.kind || '');
  if (!isCatalogKind(kind)) return NextResponse.json({ error: 'kind inválido' }, { status: 400 });

  if (b.action === 'reset') {
    await saveSetting(catalogKey(kind), { items: [] });
    await logAdmin(user.email, 'catalog_reset', kind, {});
    return NextResponse.json({ ok: true, items: CATALOG_DEFAULTS[kind], isDefault: true });
  }

  const items = clean(b.items);
  if (!items.length) return NextResponse.json({ error: 'La lista está vacía.', code: 'missing_data' }, { status: 400 });
  // Sin duplicados por código (nos quedamos con la primera aparición)
  const seen = new Set<string>();
  const uniq = items.filter((it) => (seen.has(it.code) ? false : (seen.add(it.code), true)));

  await saveSetting(catalogKey(kind), { items: uniq });
  await logAdmin(user.email, 'catalog_save', kind, { count: uniq.length });
  return NextResponse.json({ ok: true, items: uniq, isDefault: false });
}
