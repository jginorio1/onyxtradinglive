import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · historial de auditorías (para calendario, gráfico y promedios).
export async function GET(req: Request) {
  const { ok } = await requirePerm('ajustes', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const days = Math.min(365, Number(new URL(req.url).searchParams.get('days')) || 120);
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data } = await supabaseAdmin.from('audit_runs')
    .select('at,url,performance,accessibility,seo,best_practices,lcp,inp,cls,ts_errors,vulnerabilities,sec_overall,sec_fails,sec_warns')
    .gte('at', since).order('at', { ascending: true }).limit(400);

  const runs = data || [];

  // Promedios (solo de las notas de Lighthouse que existan)
  const avg = (k: string) => {
    const vals = runs.map((r: any) => r[k]).filter((v: any) => typeof v === 'number');
    return vals.length ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : null;
  };
  const averages = {
    performance: avg('performance'), accessibility: avg('accessibility'),
    seo: avg('seo'), best_practices: avg('best_practices'), count: runs.length,
  };

  return NextResponse.json({ runs, averages });
}
