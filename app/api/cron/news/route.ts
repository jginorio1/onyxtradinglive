import { NextResponse } from 'next/server';
import { runNewsPilot } from '@/lib/newsPilot';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;   // deja tiempo a los feeds + la IA

// Cron del piloto de noticias: vigila fuentes, y en modo auto escribe+publica+envía
// al instante. Protegido con CRON_SECRET (header Authorization o ?key=).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    const q = new URL(req.url).searchParams.get('key') || '';
    if (auth !== `Bearer ${secret}` && q !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const r = await runNewsPilot();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('cron_news', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
