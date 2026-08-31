import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/settings';
import { CATALOG_DEFAULTS, catalogKey, isCatalogKind, type CatalogItem } from '@/lib/catalogDefaults';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Público: devuelve la lista de un catálogo (países, plataformas, tipos de trader,
// prop firms/brokers). La usan los selectores del app. Si el admin no ha guardado
// nada, se devuelven los valores por defecto.
export async function GET(req: Request) {
  try {
    const kind = new URL(req.url).searchParams.get('kind') || '';
    if (!isCatalogKind(kind)) return NextResponse.json({ items: [] });
    const s = await getSetting<{ items: CatalogItem[] }>(catalogKey(kind), { items: CATALOG_DEFAULTS[kind] });
    const items = (s?.items?.length ? s.items : CATALOG_DEFAULTS[kind]);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
