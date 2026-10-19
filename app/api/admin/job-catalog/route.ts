import { NextResponse } from 'next/server';
import { requirePerm, logAdmin, reqCtx } from '@/lib/admin';
import { jobCatalogSettings, saveSetting, type JobCatalog, type JobMatrix } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Catálogo de PUESTOS de dos niveles (matriz → puestos). Lo lee cualquiera con
// acceso al equipo (para poblar la ficha); solo quien gestiona el equipo lo guarda.
export async function GET() {
  const g = await requirePerm('equipo', 'view');
  if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const catalog = await jobCatalogSettings();
  return NextResponse.json(catalog);
}

// Normaliza/limpia lo que viene del cliente. Hasta 20 matrices, 40 puestos c/u.
function clean(body: any): JobCatalog {
  const arr = Array.isArray(body?.matrices) ? body.matrices : [];
  const matrices: JobMatrix[] = arr.slice(0, 20).map((m: any, i: number) => {
    const label = String(m?.label || '').trim().slice(0, 40) || `Matriz ${i + 1}`;
    const id = String(m?.id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) || `m${i}`;
    const items = Array.from(new Set((Array.isArray(m?.items) ? m.items : []).map((x: any) => String(x || '').trim().slice(0, 60)).filter(Boolean))).slice(0, 40) as string[];
    return { id, label, items };
  }).filter((m: JobMatrix) => m.label);
  return { matrices };
}

export async function POST(req: Request) {
  const g = await requirePerm('equipo', 'manage');
  if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const body = await req.json().catch(() => ({}));
    const catalog = clean(body);
    await saveSetting('job_catalog', catalog);
    await logAdmin(g.user?.email || '', 'job_catalog', 'job_catalog', { matrices: catalog.matrices.length }, reqCtx(req, 'equipo'));
    return NextResponse.json({ ok: true, ...catalog });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
