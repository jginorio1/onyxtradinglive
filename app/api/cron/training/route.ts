import { NextResponse } from 'next/server';
import { runTrainingReminders, autoEnrollSync } from '@/lib/training';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Recordatorios de formación (cursos pendientes + certificados por vencer) y
// sincronización de altas automáticas desde ventas/equipo. Protegido con
// CRON_SECRET. Programar 1 vez al día en Vercel Cron.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${secret}` || q === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const enroll = await autoEnrollSync();
  const reminders = await runTrainingReminders();
  return NextResponse.json({ ok: true, enrolled: enroll.added, ...reminders });
}
