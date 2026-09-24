import { NextResponse } from 'next/server';
import { sweepBookings } from '@/lib/adBooking';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Cron: enciende/apaga las reservas de espacios de forma automática.
//  · Las campañas cuyas fechas ya terminaron pasan a 'expired'.
//  · Los "holds" (pre-reservas sin pagar) caducados se liberan y el cupo vuelve
//    a estar disponible.
// El encendido en la fecha de inicio ya lo hace pickAd por ventana de fechas;
// aquí solo cerramos y limpiamos. Se protege con CRON_SECRET si está definido.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && new URL(req.url).searchParams.get('key') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const r = await sweepBookings();
  return NextResponse.json({ ok: true, ...r });
}
