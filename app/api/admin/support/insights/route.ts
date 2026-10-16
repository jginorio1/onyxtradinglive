import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logError } from '@/lib/errlog';
import { getInsights, rangeForDays, draftArticle } from '@/lib/supportInsights';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET ?days=30 (o ?from&to) [&refresh=1] · KPIs + insights de IA (con caché).
export async function GET(req: Request) {
  const { ok } = await requirePerm('soporte', 'view');
  if (!ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const sp = new URL(req.url).searchParams;
    const en = (sp.get('lang') || 'es') === 'en';
    let from = sp.get('from') || '';
    let to = sp.get('to') || '';
    if (!from || !to) {
      const days = Math.min(365, Math.max(1, parseInt(sp.get('days') || '30', 10) || 30));
      const r = rangeForDays(days);
      from = r.from; to = r.to;
    }
    const refresh = sp.get('refresh') === '1';
    const data = await getInsights(from, to, en, refresh);
    return NextResponse.json({ ok: true, ...data });
  } catch (e: any) {
    await logError('support_insights', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// POST { title, body } · crea un artículo en la Base IA (kb_articles) desde un
// hallazgo/tema del panel. Así se cierra el círculo: lo que la gente pregunta se
// vuelve conocimiento que la IA ya sabrá responder sola.
export async function POST(req: Request) {
  const { ok } = await requirePerm('soporte', 'edit');
  if (!ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    const en = (b.lang || 'es') === 'en';
    // Si viene `topic` (una sugerencia del panel), la IA REDACTA el artículo completo
    // (título + contenido con pasos). Si vienen title/body explícitos, se usan tal cual.
    let title = String(b.title || '').trim().slice(0, 120);
    let body = String(b.body || '').trim().slice(0, 6000);
    const topic = String(b.topic || '').trim();
    if (topic && !body) {
      const a = await draftArticle(topic, en);
      title = a.title || title || topic.slice(0, 120);
      body = a.body;
    }
    if (!title) return NextResponse.json({ error: 'title' }, { status: 400 });
    const { error } = await supabaseAdmin.from('kb_articles').insert({ title, body: body || title, tags: 'soporte, insights', published: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, title });
  } catch (e: any) {
    await logError('support_insights', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
