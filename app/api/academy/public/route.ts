import { NextResponse } from 'next/server';
import { publicDirectory, publicAcademy } from '@/lib/academy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Público (sin sesión). ?code=XXX → una academia; sin code → directorio.
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code');
  if (code) {
    const a = await publicAcademy(code);
    if (!a) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ academy: a });
  }
  return NextResponse.json({ academies: await publicDirectory() });
}
