import { NextResponse } from 'next/server';
import { getRemoteConfig } from '@/lib/remoteSupport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET público · ¿está activo el soporte remoto de pago y a qué precio?
// Lo usa la burbuja para mostrar (o no) el botón "Agendar soporte remoto".
// Solo campos públicos: nunca expone la instrucción interna completa.
export async function GET() {
  try {
    const cfg = await getRemoteConfig();
    return NextResponse.json({ on: !!cfg.on, price: cfg.price, minutes: cfg.minutes, tool: cfg.tool });
  } catch {
    return NextResponse.json({ on: false });
  }
}
