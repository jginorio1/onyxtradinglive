import { NextResponse } from 'next/server';
import { careersSettings, openPositions, submitApplication, pushSalesApplication } from '@/lib/careers';

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

  // Plaza de ventas: registra también en el reclutamiento de ventas (pipeline).
  const isSales = !!(r as any).sales;
  if (isSales && !r.duplicated) { try { await pushSalesApplication((r as any).sales); } catch {} }

  // Aviso al equipo. Para ventas va a la dirección de ventas; si no, a RRHH/soporte.
  try {
    const mail: any = await import('@/lib/mail');
    const mr: any = await import('@/lib/settings');
    const routes: any = (mr.mailRoutes ? await mr.mailRoutes().catch(() => ({})) : {}) || {};
    const to = String((isSales ? routes.sales : 0) || routes.support || process.env.SUPPORT_EMAIL || 'support@onyxtradinglive.com').trim();
    const subj = isSales ? `🧑‍💼 Postulación de ventas (Carreras) · ${b.name}` : `🧑‍💻 Nueva postulación · ${b.name}`;
    await mail.sendEmail(to, subj,
      `Plaza: ${b.job_title || '(general)'}${isSales ? ' · POR COMISIÓN' : ''}\nNombre: ${b.name}\nEmail: ${b.email}\nTeléfono: ${b.phone || '-'}\nPaís: ${b.country || '-'}\n${isSales ? `Audiencia: ${b.audience || '-'}\nExperiencia: ${b.experience || '-'}\n` : ''}Mensaje: ${b.message || '-'}\n\nRevísala en Admin → ${isSales ? 'Ventas (y también aparece en Carreras)' : 'Carreras'}.`);
  } catch {}
  return NextResponse.json(r);
}
