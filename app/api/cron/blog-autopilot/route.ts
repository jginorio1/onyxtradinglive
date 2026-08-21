import { NextResponse } from 'next/server';
import { runAutopilot } from '@/lib/blogAutopilot';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;   // la generación con IA puede tardar

// Cron del piloto automático del blog: genera el contenido de la próxima fecha
// pendiente (una por pasada, para no chocar con límites/timeouts) y, si quedan
// pocas fechas futuras, planifica el siguiente lote. Protegido con CRON_SECRET.
// Recomendado ejecutarlo 2-4 veces al día en Vercel.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && new URL(req.url).searchParams.get('key') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const r = await runAutopilot();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('cron_blog_autopilot', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
