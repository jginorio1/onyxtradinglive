import { NextResponse } from 'next/server';
import { sendNewsDigest, nyHour } from '@/lib/blogEmail';
import { newsPilotSettings } from '@/lib/settings';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Cron del RESUMEN DIARIO de noticias. Vercel dispara en UTC sin horario de verano,
// así que este endpoint se agenda a las 12:00 y 13:00 UTC y AQUÍ decide: solo envía
// cuando la hora local de Nueva York coincide con la elegida (por defecto 8:00, ≈1.5 h
// antes de la apertura). Protegido con CRON_SECRET. Con ?force=1 envía al instante (test).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    const q = url.searchParams.get('key') || '';
    if (auth !== `Bearer ${secret}` && q !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const force = url.searchParams.get('force') === '1';
    if (!force) {
      const cfg = await newsPilotSettings();
      if ((cfg as any).emailMode !== 'digest') return NextResponse.json({ ok: true, ran: false, reason: 'not_digest_mode' });
      const target = Math.max(0, Math.min(23, (cfg as any).digestHourNY ?? 8));
      if (nyHour() !== target) return NextResponse.json({ ok: true, ran: false, reason: 'not_the_hour', nyHour: nyHour(), target });
    }
    const r = await sendNewsDigest(force);
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('cron_news_digest', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
