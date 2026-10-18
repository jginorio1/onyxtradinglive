import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Calificación de satisfacción (CSAT) del cliente al resolver su ticket.
// El enlace del correo trae el token y la puntuación: /api/support/csat?t=TOKEN&s=5
// GET = un clic (devuelve una página de gracias). POST = con comentario opcional.
// No requiere sesión (el token es el secreto). Idempotente: guarda la última nota.

function thanks(es: boolean, score: number) {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${es ? 'Gracias' : 'Thanks'}</title>
<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:420px;margin:60px auto;text-align:center;color:#1a1a1a">
<div style="font-size:46px">${score >= 4 ? '🙌' : score === 3 ? '🙂' : '🙏'}</div>
<h2 style="margin:12px 0 6px">${es ? '¡Gracias por tu opinión!' : 'Thanks for your feedback!'}</h2>
<p style="color:#666;font-size:14px">${es ? 'Nos ayuda a mejorar el soporte de Onyx.' : 'It helps us improve Onyx support.'}</p>
</div>`;
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

async function record(token: string, score: number, comment?: string) {
  if (!token || !(score >= 1 && score <= 5)) return { ok: false };
  const { data: t } = await supabaseAdmin.from('support_tickets').select('id,lang').eq('csat_token', token).maybeSingle();
  if (!(t as any)?.id) return { ok: false, notFound: true };
  const patch: any = { csat: score, csat_at: new Date().toISOString() };
  if (comment) patch.csat_comment = String(comment).slice(0, 1000);
  await supabaseAdmin.from('support_tickets').update(patch).eq('id', (t as any).id).then((r: any) => {
    if (r?.error) return supabaseAdmin.from('support_tickets').update({ csat: score }).eq('id', (t as any).id);
  });
  // Nota interna para que el equipo vea la calificación en el hilo.
  try { await supabaseAdmin.from('support_messages').insert({ ticket_id: (t as any).id, sender: 'note', body: `⭐ Calificación del cliente: ${score}/5${comment ? ` — "${String(comment).slice(0, 200)}"` : ''}` }); } catch {}
  return { ok: true, lang: (t as any).lang === 'en' ? 'en' : 'es' };
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const token = String(sp.get('t') || sp.get('token') || '');
  const score = parseInt(String(sp.get('s') || sp.get('score') || ''), 10);
  const r = await record(token, score);
  return thanks(r.lang !== 'en', score);
}

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const r = await record(String(b.token || b.t || ''), parseInt(String(b.score || b.s), 10), b.comment);
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
