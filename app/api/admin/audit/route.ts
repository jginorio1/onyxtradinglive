import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { getSetting, saveSetting } from '@/lib/settings';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { coreSecurityItems, summarize } from '@/lib/securityAudit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Resultado de la última auditoría (lo escribe el CI de GitHub Actions).
type Audit = {
  at: string | null;
  lighthouse: { url: string; performance: number; accessibility: number; seo: number; best_practices: number } | null;
  vitals: { lcp: number; inp: number; cls: number } | null;
  flows: { name: string; ok: boolean }[];
  code: { ts_errors: number; vulnerabilities: number };
};
const A0: Audit = { at: null, lighthouse: null, vitals: null, flows: [], code: { ts_errors: 0, vulnerabilities: 0 } };

// GET · estado para el panel (owner)
export async function GET() {
  const { ok } = await requirePerm('ajustes', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const audit = await getSetting<Audit>('audit', A0);
  return NextResponse.json({ audit });
}

// POST · lo llama el CI tras correr las pruebas. Sin sesión: valida CRON_SECRET.
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret') || new URL(req.url).searchParams.get('secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }
  const b = await req.json().catch(() => ({}));
  const audit: Audit = {
    at: new Date().toISOString(),
    lighthouse: b.lighthouse || null,
    vitals: b.vitals || null,
    flows: Array.isArray(b.flows) ? b.flows : [],
    code: { ts_errors: Number(b.code?.ts_errors) || 0, vulnerabilities: Number(b.code?.vulnerabilities) || 0 },
  };
  await saveSetting('audit', audit);

  // Guardar en el historial (para calendario/gráfico/promedios), con una foto
  // del estado de seguridad en ese momento.
  try {
    const sec = summarize(await coreSecurityItems());
    await supabaseAdmin.from('audit_runs').insert({
      at: audit.at,
      url: audit.lighthouse?.url || null,
      performance: audit.lighthouse?.performance ?? null,
      accessibility: audit.lighthouse?.accessibility ?? null,
      seo: audit.lighthouse?.seo ?? null,
      best_practices: audit.lighthouse?.best_practices ?? null,
      lcp: audit.vitals?.lcp ?? null,
      inp: audit.vitals?.inp ?? null,
      cls: audit.vitals?.cls ?? null,
      ts_errors: audit.code.ts_errors,
      vulnerabilities: audit.code.vulnerabilities,
      sec_overall: sec.overall, sec_fails: sec.fails, sec_warns: sec.warns,
    });
  } catch { /* si no está la tabla aún, no rompemos el CI */ }

  return NextResponse.json({ ok: true });
}
