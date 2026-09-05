import { NextResponse } from 'next/server';
import { getAdmin, logAdmin } from '@/lib/admin';
import { listBots, listDatasets, factoryStats, saveDataset, createBot, deleteBot, genUniqueName, validateMetrics, runLab, listLabRuns, compareBt, advanceToDemo } from '@/lib/factory';
import { pipelineBoard, runPipelineOnce, linkDemo, stageOverride, approveReal } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function canManage(role: string | null, perms: any) {
  return role === 'owner' || perms?.modulos === 'manage';
}

// GET · lo que necesita el panel de la fábrica.
export async function GET() {
  const { isAdmin, role, perms } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const [bots, datasets, stats, preview] = await Promise.all([listBots(), listDatasets(), factoryStats(), genUniqueName()]);
  return NextResponse.json({ bots, datasets, stats, nextName: preview.name, canManage: canManage(role, perms) });
}

// POST · acciones del dueño/gestor de módulos.
export async function POST(req: Request) {
  const { user, isAdmin, role, perms } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const a = b.action;

  // Veredicto de calidad en caliente (sin guardar) para previsualizar al subir.
  if (a === 'validate') {
    return NextResponse.json({ quality: validateMetrics(b.metrics || {}) });
  }

  if (!canManage(role, perms)) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  if (a === 'dataset_save') {
    try {
      const r = await saveDataset({ userId: user.id, symbol: b.symbol, timeframe: b.timeframe, filename: b.filename, metrics: b.metrics || {} });
      await logAdmin(user.email || '', 'factory_dataset', r.dataset?.id || '', { verdict: r.quality.verdict, score: r.quality.score });
      return NextResponse.json(r);
    } catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 400 }); }
  }
  if (a === 'bot_create') {
    try {
      const bot = await createBot({ userId: user.id, platform: b.platform, symbol: b.symbol, timeframe: b.timeframe, strategy: b.strategy, datasetId: b.datasetId });
      await logAdmin(user.email || '', 'factory_bot_create', bot?.id || '', { name: bot?.name });
      return NextResponse.json({ ok: true, bot });
    } catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 400 }); }
  }
  if (a === 'bot_delete') {
    await deleteBot(String(b.id || ''));
    await logAdmin(user.email || '', 'factory_bot_delete', String(b.id || ''), {});
    return NextResponse.json({ ok: true });
  }
  if (a === 'lab_runs') {
    const runs = await listLabRuns(String(b.botId || ''));
    return NextResponse.json({ runs });
  }
  if (a === 'lab_run') {
    try {
      const r = await runLab({ userId: user.id, botId: String(b.botId || ''), trades: b.trades || [], grid: b.grid, paramCount: b.paramCount, lang: b.lang === 'en' ? 'en' : 'es' });
      await logAdmin(user.email || '', 'factory_lab_run', String(b.botId || ''), { score: r.robustness.score, verdict: r.robustness.verdict });
      return NextResponse.json(r);
    } catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 400 }); }
  }
  if (a === 'lab_compare') {
    try { const cmp = await compareBt({ runId: String(b.runId || ''), botId: String(b.botId || ''), mt: b.mt || {} }); return NextResponse.json(cmp); }
    catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 400 }); }
  }
  if (a === 'lab_advance') {
    try { const r = await advanceToDemo(String(b.botId || '')); await logAdmin(user.email || '', 'factory_advance_demo', String(b.botId || ''), {}); return NextResponse.json(r); }
    catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 400 }); }
  }
  if (a === 'pipeline') { const board = await pipelineBoard(); return NextResponse.json(board); }
  if (a === 'pipeline_run') { try { const r = await runPipelineOnce(); await logAdmin(user.email || '', 'factory_pipeline_run', '', r); return NextResponse.json(r); } catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 400 }); } }
  if (a === 'link_demo') { try { const r = await linkDemo(String(b.botId || ''), Number(b.magic || 0), b.account || undefined); await logAdmin(user.email || '', 'factory_link_demo', String(b.botId || ''), { magic: b.magic }); return NextResponse.json(r); } catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 400 }); } }
  if (a === 'stage_override') { try { const r = await stageOverride(String(b.botId || ''), b.dir === 'archive' ? 'archive' : 'advance'); await logAdmin(user.email || '', 'factory_stage_override', String(b.botId || ''), { dir: b.dir }); return NextResponse.json(r); } catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 400 }); } }
  if (a === 'approve_real') { try { const r = await approveReal(String(b.botId || '')); await logAdmin(user.email || '', 'factory_approve_real', String(b.botId || ''), {}); return NextResponse.json(r); } catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 400 }); } }
  return NextResponse.json({ error: 'acción no válida' }, { status: 400 });
}
