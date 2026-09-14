import { NextResponse } from 'next/server';
import { careersSettings, openPositions, submitApplication } from '@/lib/careers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET público · ajustes de la página + plazas abiertas.
export async function GET() {
  const settings = await careersSettings();
  if (!settings.enabled) return NextResponse.json({ enabled: false, positions: [] });
  const positions = await openPositions();
  return NextResponse.json({ enabled: true, settings, positions });
}

// POST público · postularse a una plaza.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({} as any));
  const r = await submitApplication(b);
  if (!r.ok) return NextResponse.json(r, { status: 400 });

  // Aviso al equipo (email a rrhh/support si están). Silencioso si falla.
  try {
    const mail: any = await import('@/lib/mail');
    const mr: any = await import('@/lib/settings');
    const routes: any = (mr.mailRoutes ? await mr.mailRoutes().catch(() => ({})) : {}) || {};
    const to = String(routes.support || process.env.SUPPORT_EMAIL || 'support@onyxtradinglive.com').trim();
    await mail.sendEmail(to, `🧑‍💻 Nueva postulación · ${b.name}`,
      `Plaza: ${b.job_title || '(general)'}\nNombre: ${b.name}\nEmail: ${b.email}\nTeléfono: ${b.phone || '-'}\nPaís: ${b.country || '-'}\nMensaje: ${b.message || '-'}\n\nRevísala en Admin → Carreras.`);
  } catch {}
  return NextResponse.json(r);
}
