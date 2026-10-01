import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { draftEmail } from '@/lib/emailAI';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · la IA redacta (mode 'draft') o reescribe/mejora (mode 'rewrite') un
// correo. Devuelve asunto+cuerpo ES/EN editable. No envía nada.
export async function POST(req: Request) {
  const p = await requirePerm('campanas', 'manage');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    const instruction = String(b.instruction || '').slice(0, 1200).trim();
    if (!instruction) return NextResponse.json({ error: 'Escribe qué quieres que haga la IA.' }, { status: 400 });
    const r = await draftEmail({
      mode: b.mode === 'rewrite' ? 'rewrite' : 'draft',
      instruction,
      tone: b.tone,
      vars: Array.isArray(b.vars) ? b.vars.map(String).slice(0, 12) : [],
      currentEs: b.currentEs, currentEn: b.currentEn,
    });
    if (!r.ok) {
      const msg = r.reason === 'no_key' ? 'Falta ANTHROPIC_API_KEY en el servidor.' : 'La IA no pudo generar el texto. Intenta de nuevo.';
      return NextResponse.json({ error: msg, reason: r.reason }, { status: r.reason === 'no_key' ? 400 : 502 });
    }
    return NextResponse.json({ ok: true, draft: r.draft });
  } catch (e: any) {
    await logError('emails_ai', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
