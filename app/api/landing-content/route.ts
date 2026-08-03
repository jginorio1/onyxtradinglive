import { NextResponse } from 'next/server';
import { landingContent } from '@/lib/landingContent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;      // nunca cachear en el servidor
export const runtime = 'nodejs';

// Público: el contenido editable del landing para que las páginas lo apliquen.
// Cabeceras agresivas para que NI Vercel/CDN NI el navegador guarden la respuesta:
// así, al editar (o quitar) un texto en el Builder, el cambio se refleja al instante
// y al borrarlo, de verdad vuelve al texto original — sin quedarse "pegado".
const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
};

export async function GET() {
  const c = await landingContent();
  return NextResponse.json(c, { headers: NO_STORE });
}
