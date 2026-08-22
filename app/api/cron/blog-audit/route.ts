import { NextResponse } from 'next/server';
import { autoFixCfg, autoFixOne } from '@/lib/blogAudit';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Cron del auto-mejorador del blog: si el dueño lo activó, mejora 1 artículo por
// pasada (el de peor SEO por debajo del umbral, sin tocar los recién arreglados).
// Corre seguido → limpia el backlog en horas, SIN depender del navegador.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && new URL(req.url).searchParams.get('key') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const cfg = await autoFixCfg();
    if (!cfg.enabled) return NextResponse.json({ ok: true, skipped: 'disabled' });
    const r = await autoFixOne(cfg.threshold || 70);
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await logError('cron_blog_audit', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
