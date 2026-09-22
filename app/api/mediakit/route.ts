import { NextResponse } from 'next/server';
import { buildMediaKit } from '@/lib/mediakit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET público · devuelve el media kit (estadísticas + inventario + paquetes).
// Lo consumen la página /publicidad/estadisticas y la propuesta imprimible.
export async function GET() {
  try {
    const kit = await buildMediaKit();
    return NextResponse.json(kit, { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
