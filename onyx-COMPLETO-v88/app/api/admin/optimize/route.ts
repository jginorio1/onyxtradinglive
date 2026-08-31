import { NextResponse } from 'next/server';
import { getAdmin, requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSetting, saveSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Run = { at: string; pruned_errors: number; pruned_tg: number; analyzed: boolean };
type Optimize = {
  enabled: boolean;
  last_at: string | null;
  pruned_errors: number;
  pruned_tg: number;
  analyzed: boolean;
  images: { count: number; saved_bytes: number };
  history: Run[];
};
const O0: Optimize = { enabled: true, last_at: null, pruned_errors: 0, pruned_tg: 0, analyzed: false, images: { count: 0, saved_bytes: 0 }, history: [] };

const DAYS = 90;

// GET · estado para el panel (owner): ajustes + tamaño de la base + tablas grandes
export async function GET() {
  const { ok } = await requirePerm('ajustes', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const optimize = await getSetting<Optimize>('optimize', O0);

  let db_bytes = 0;
  let tables: { name: string; bytes: number; rows: number }[] = [];
  try { const { data } = await supabaseAdmin.rpc('db_total_size'); db_bytes = Number(data) || 0; } catch {}
  try {
    const { data } = await supabaseAdmin.rpc('db_table_sizes');
    tables = (data || []).map((t: any) => ({ name: t.name, bytes: Number(t.bytes) || 0, rows: Number(t.rows) || 0 }));
  } catch {}

  return NextResponse.json({ optimize, db_bytes, tables });
}

// POST · ejecuta la optimización. Lo llama la tarea programada (CRON_SECRET)
// o el Owner con el botón "Ejecutar ahora".
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret') || new URL(req.url).searchParams.get('secret');
  const bySecret = !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET;
  if (!bySecret) {
    const { ok } = await requirePerm('ajustes', 'manage');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  }

  const prev = await getSetting<Optimize>('optimize', O0);
  if (prev.enabled === false && bySecret) return NextResponse.json({ ok: true, skipped: true });

  const cutoff = new Date(Date.now() - DAYS * 86400000).toISOString();
  const prune = async (tabla: string): Promise<number> => {
    try { const { data } = await supabaseAdmin.from(tabla).delete().lt('created_at', cutoff).select('id'); return data?.length || 0; }
    catch { return 0; }
  };
  const pruned_errors = await prune('app_errors');
  const pruned_tg = await prune('telegram_log');

  let analyzed = false;
  try { const { error } = await supabaseAdmin.rpc('optimize_maintenance'); analyzed = !error; } catch {}

  const at = new Date().toISOString();
  const run: Run = { at, pruned_errors, pruned_tg, analyzed };
  const history = [run, ...(prev.history || [])].slice(0, 8);   // guarda las últimas 8
  const next: Optimize = { ...prev, last_at: at, pruned_errors, pruned_tg, analyzed, history };
  await saveSetting('optimize', next);
  return NextResponse.json({ ok: true, pruned_errors, pruned_tg, analyzed });
}

// PATCH · encender/apagar la optimización automática (owner)
export async function PATCH(req: Request) {
  const me = await getAdmin();
  const { ok } = await requirePerm('ajustes', 'manage');
  if (!me.isAdmin || !ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const prev = await getSetting<Optimize>('optimize', O0);
  await saveSetting('optimize', { ...prev, enabled: b.enabled !== false });
  return NextResponse.json({ ok: true });
}
