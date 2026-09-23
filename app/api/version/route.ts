import { NextResponse } from 'next/server';
import { APP_VERSION } from '@/lib/version';

// Devuelve la versión del build que corre AHORA en el servidor. El cliente la
// compara con la suya (la que quedó horneada en su bundle): si difieren, el
// cliente está corriendo código viejo (típico en PWA instalada) y se recarga
// una sola vez. Nunca se cachea, para que siempre diga la verdad.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { v: APP_VERSION },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'CDN-Cache-Control': 'no-store' } },
  );
}
