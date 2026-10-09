import { NextResponse } from 'next/server';
import { vpsInfo } from '@/lib/botlab';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Público: el VPS recomendado (afiliado) que el admin edita en Bot Lab. Lo leen
// las tarjetas del marketplace, la guía y el chat para pintar el mismo enlace.
export async function GET() {
  try {
    const v = await vpsInfo();
    // Sin caché: el CDN podía congelar una respuesta vieja con url:'' (de antes de
    // guardar el enlace) hasta 2 min. El chat lee vpsInfo() en el servidor y nunca
    // pasa por aquí, por eso sí mostraba el enlace. Ahora siempre devolvemos lo último.
    return NextResponse.json(v, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch {
    return NextResponse.json({ on: false, url: '', name: '', note_es: '', note_en: '' }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
