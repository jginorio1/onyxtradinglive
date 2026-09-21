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
    const r = await runAutopilot();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('cron_blog_autopilot', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
