import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { draftCampaign, suggestSubjects } from '@/lib/campaignAI';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · IA para campañas.
//   mode:'titles' → 5 opciones de asunto ES/EN (como el blog).
//   (por defecto) → borrador completo (asunto + cuerpo ES/EN), respetando el
//   asunto ya elegido si viene, integrando variables y el tono pedido.
export async function POST(req: Request) {
  const p = await requirePerm('campanas', 'manage');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    const topic = String(b.topic || '').trim();
    if (!topic) return NextResponse.json({ error: 'Escribe de qué trata el correo.' }, { status: 400 });
    const segment = b.segment || 'all';
    const tone = String(b.tone || 'friendly');

    if (b.mode === 'titles') {
      const r = await suggestSubjects({ topic, segment, tone });
      if (!r.ok) {
        const msg = r.reason === 'no_key' ? 'La IA no está configurada: falta ANTHROPIC_API_KEY en Vercel.' : 'La IA no pudo sugerir títulos. Inténtalo otra vez.';
        return NextResponse.json({ error: msg, reason: r.reason }, { status: 400 });
      }
      return NextResponse.json({ ok: true, titles: r.titles });
    }

    const r = await draftCampaign({ topic, segment, tone, subject_es: b.subject_es, subject_en: b.subject_en });
    if (!r.ok) {
      const msg = r.reason === 'no_key'
        ? 'La IA no está configurada: falta ANTHROPIC_API_KEY en Vercel.'
        : 'La IA no pudo generar el borrador. Inténtalo otra vez.';
      return NextResponse.json({ error: msg, reason: r.reason }, { status: 400 });
    }
    return NextResponse.json({ ok: true, draft: r.draft });
  } catch (e: any) {
    await logError('campaigns_draft', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
