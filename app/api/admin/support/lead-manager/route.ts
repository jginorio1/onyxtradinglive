import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { leadManagerStats } from '@/lib/leadManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · Lead Manager: de dónde vienen los clientes (altas por fuente) + ingreso
// mensual atribuido por fuente. ?days=7|30|90 (por defecto 30).
export async function GET(req: Request) {
  const g = await requirePerm('soporte', 'view');
  if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const days = Math.min(365, Math.max(1, parseInt(new URL(req.url).searchParams.get('days') || '30', 10) || 30));
  try {
    const data = await leadManagerStats(days);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
