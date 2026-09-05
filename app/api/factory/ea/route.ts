import { NextResponse } from 'next/server';
import { eaControl } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// El EA del robot en la cuenta demo consulta aquí cómo debe autoregularse:
//   risk_factor = 1 (normal) · 0.5 (mitad, semáforo amarillo) · 0 (paper, naranja)
// Uso: GET /api/factory/ea?account=<uuid>&magic=<n>
export async function GET(req: Request) {
  const u = new URL(req.url);
  const account = u.searchParams.get('account') || '';
  const magic = Number(u.searchParams.get('magic') || '0');
  if (!account || !magic) return NextResponse.json({ error: 'faltan parámetros' }, { status: 400 });
  try {
    const c = await eaControl(account, magic);
    return NextResponse.json(c);
  } catch {
    return NextResponse.json({ risk_factor: 1, paper: false, health: 'green', stage: null });
  }
}
