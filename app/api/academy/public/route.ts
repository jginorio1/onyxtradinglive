import { NextResponse } from 'next/server';
import { publicDirectory, publicAcademy } from '@/lib/academy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

// Nunca cachear: el mentor edita y debe verse al instante en la landing.
const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate' };

// Público (sin sesión). ?code=XXX → una academia; sin code → directorio.
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code');
  if (code) {
    const a = await publicAcademy(code);
    if (!a) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_CACHE });
    return NextResponse.json({ academy: a }, { headers: NO_CACHE });
  }
  return NextResponse.json({ academies: await publicDirectory() }, { headers: NO_CACHE });
}
