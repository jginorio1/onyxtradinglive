import { NextResponse } from 'next/server';
import { publishDuePosts } from '@/lib/blog';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Cron: publica los artículos del blog cuya fecha/hora programada ya llegó.
// Protegido con CRON_SECRET (?key=...). Ejecútalo cada 5-15 min en Vercel.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    // Vercel Cron autentica con el header Authorization: Bearer <CRON_SECRET>.
    // Aceptamos ese header O ?key=<secret> (para pruebas manuales).
    const auth = req.headers.get('authorization') || '';
    const q = new URL(req.url).searchParams.get('key') || '';
    if (auth !== `Bearer ${secret}` && q !== secret) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }
  try {
    const published = await publishDuePosts();
    return NextResponse.json({ ok: true, published });
  } catch (e: any) {
    await logError('cron_blog', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
