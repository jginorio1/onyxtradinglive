import { NextResponse } from 'next/server';
import { getInsights, rangeForDays } from '@/lib/supportInsights';
import { broadcastTeam } from '@/lib/supportNotify';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Resumen semanal de Insights de soporte por Telegram al equipo (7 días).
// Protegido con CRON_SECRET. Programar semanal (p.ej. lunes 8:00) en Vercel Cron.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${secret}` || q === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try {
    const { from, to } = rangeForDays(7);
    const { kpis, ai } = await getInsights(from, to, false, true);
    if (!kpis.total) return NextResponse.json({ ok: true, skipped: 'sin conversaciones' });

    const topTopics = (ai.topics || []).slice(0, 3).map((t) => `• ${t.label} (${t.count})`).join('\n');
    const improve = (ai.improve || []).slice(0, 3).map((s) => `• ${s}`).join('\n');
    const text =
      `📊 <b>Resumen semanal de soporte</b>\n` +
      `${kpis.total} conversaciones · ${kpis.leads} leads · ${kpis.aiResolvedPct}% resueltas por IA · ${kpis.humanPct}% con persona\n\n` +
      (topTopics ? `<b>Más preguntado</b>\n${topTopics}\n\n` : '') +
      (improve ? `<b>Dónde mejorar</b>\n${improve}\n\n` : '') +
      `Abre Admin → Soporte → Insights para el detalle.`;

    const sent = await broadcastTeam(text, 'support_digest');
    return NextResponse.json({ ok: true, sent, total: kpis.total });
  } catch (e: any) {
    await logError('support_digest', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
