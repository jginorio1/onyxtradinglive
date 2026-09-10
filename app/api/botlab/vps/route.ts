import { NextResponse } from 'next/server';
import { vpsInfo } from '@/lib/botlab';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Público: el VPS recomendado (afiliado) que el admin edita en Bot Lab. Lo leen
// las tarjetas del marketplace, la guía y el chat para pintar el mismo enlace.
export async function GET() {
  try {
    const v = await vpsInfo();
    return NextResponse.json(v, { headers: { 'Cache-Control': 'public, max-age=120' } });
  } catch {
    return NextResponse.json({ on: false, url: '', name: '', note_es: '', note_en: '' });
  }
}
