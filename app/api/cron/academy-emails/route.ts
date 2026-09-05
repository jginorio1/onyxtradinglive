import { NextResponse } from 'next/server';
import { runDueCampaigns, runAutomations } from '@/lib/academyEmail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Envía las campañas programadas del mentor y corre las automatizaciones de ciclo
// de vida (bienvenida, recordatorio de clase, membresía por vencer).
// Protegido con CRON_SECRET. Programar cada ~15 min en Vercel Cron.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${secret}` || q === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const campaigns = await runDueCampaigns();
  const automations = await runAutomations();
  return NextResponse.json({ ok: true, campaignsSent: campaigns, automationEmails: automations });
}
