import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { draftCampaign } from '@/lib/campaignAI';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · pide a la IA un borrador de correo (asunto + cuerpo, ES/EN).
export async function POST(req: Request) {
  const p = await requirePerm('campanas', 'manage');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    const topic = String(b.topic || '').trim();
    if (!topic) return NextResponse.json({ error: 'Escribe de qué trata el correo.' }, { status: 400 });
    const r = await draftCampaign({ topic, segment: b.segment || 'all' });
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
