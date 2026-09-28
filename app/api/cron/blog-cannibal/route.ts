import { NextResponse } from 'next/server';
import { runCannibalCron } from '@/lib/blogAudit';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Cron SEMANAL de canibalización: consolida (en modo seguro) los grupos de artículos
// que apuntan a la misma keyword, redirigiendo los perdedores (301) al ganador.
// Solo corre si el dueño lo activó (blog_cannibal_auto.enabled). Protegido con CRON_SECRET.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    const q = new URL(req.url).searchParams.get('key') || '';
    if (auth !== `Bearer ${secret}` && q !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const r = await runCannibalCron();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('cron_blog_cannibal', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
