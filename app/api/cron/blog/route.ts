import { NextResponse } from 'next/server';
import { publishDuePosts } from '@/lib/blog';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Cron: publica los artículos del blog cuya fecha/hora programada ya llegó.
// Protegido con CRON_SECRET (?key=...). Ejecútalo cada 5-15 min en Vercel.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && new URL(req.url).searchParams.get('key') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const published = await publishDuePosts();
    return NextResponse.json({ ok: true, published });
  } catch (e: any) {
    await logError('cron_blog', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
