import { NextResponse } from 'next/server';
import { runOnboardingEmails } from '@/lib/onboardingEmails';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Envía la secuencia de onboarding a diario. Protegido con CRON_SECRET.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${secret}` || q === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const dry = new URL(req.url).searchParams.get('dry') === '1';
  const r = await runOnboardingEmails(dry);
  return NextResponse.json({ ok: true, ...r });
}
