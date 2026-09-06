import { NextResponse } from 'next/server';
import { getAdmin, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { listBots, listDatasets, factoryStats, saveDataset, createBot, deleteBot, genUniqueName, validateMetrics, runLab, listLabRuns, compareBt, advanceToDemo, saveGenRun, listGenRuns, getDataset, deleteDataset } from '@/lib/factory';
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
  // Crea URLs firmadas para subir DIRECTO a Storage desde el navegador
  // (evita el límite de tamaño de las funciones de Vercel → soporta varios GB).
  if (a === 'dataset_sign_upload') {
    const BUCKET = 'factory-data';
    try { await supabaseAdmin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: '6442450944' } as any); } catch { /* ya existe */ }
    const stamp = `${user.id}/${Date.now()}-${String(b.symbol || 'data').replace(/[^A-Za-z0-9]/g, '')}`;
    const barsPath = stamp + '.bars.json';
    const bs = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(barsPath);
    if (bs.error) return NextResponse.json({ error: 'firma barras: ' + bs.error.message }, { status: 500 });
    const out: any = { bars: { path: barsPath, token: bs.data?.token, url: supabaseAdmin.storage.from(BUCKET).getPublicUrl(barsPath).data.publicUrl } };
    if (b.wantTick) {
      const tickPath = stamp + '.ticks.csv';
      const ts = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(tickPath);
      if (ts.error) return NextResponse.json({ error: 'firma ticks: ' + ts.error.message }, { status: 500 });
      out.tick = { path: tickPath, token: ts.data?.token, url: supabaseAdmin.storage.from(BUCKET).getPublicUrl(tickPath).data.publicUrl };
    }
    return NextResponse.json(out);
  }
  // Guarda la ficha del dataset (metadata pequeña) tras subir los archivos.
  if (a === 'dataset_save') {
    try {
      const m = b.meta || {};
      const r = await saveDataset({
        userId: user.id, symbol: m.symbol || '', timeframe: m.timeframe || '', filename: m.filename || '', metrics: m.metrics || {},
        source: m.source, broker: m.broker, barsPath: m.barsPath, barsUrl: m.barsUrl, barsTf: m.barsTf, barsCount: m.barsCount, fileSize: m.fileSize,
        tickPath: m.tickPath, tickUrl: m.tickUrl, tickSize: m.tickSize, tickFormat: m.tickFormat,
      });
      await logAdmin(user.email || '', 'factory_dataset', r.dataset?.id || '', { verdict: r.quality.verdict, score: r.quality.score, source: m.source, ticks: !!m.tickUrl });
      return NextResponse.json(r);
    } catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 400 }); }
  }
  if (a === 'dataset_bars') {
    const ds = await getDataset(String(b.id || ''));
    if (!ds) return NextResponse.json({ error: 'dataset no encontrado' }, { status: 404 });
    return NextResponse.json({ url: ds.bars_url || null, symbol: ds.symbol, timeframe: ds.timeframe, barsTf: ds.bars_tf, barsCount: ds.bars_count });
  }
  if (a === 'dataset_delete') {
    await deleteDataset(String(b.id || ''));
    await logAdmin(user.email || '', 'factory_dataset_delete', String(b.id || ''), {});
    return NextResponse.json({ ok: true });
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
      const r = await runLab({ userId: user.id, botId: String(b.botId || ''), trades: b.trades || [], grid: b.grid, paramCount: b.paramCount, lang: b.lang === 'en' ? 'en' : 'es', noAi: !!b.noAi });
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
  if (a === 'gen_run') { try { const r = await saveGenRun({ userId: user.id, config: b.config || {}, n: Number(b.n || 1000) }); await logAdmin(user.email || '', 'factory_gen_run', r.id || '', { space: r.space, sampled: r.sampled }); return NextResponse.json(r); } catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 400 }); } }
  if (a === 'gen_list') { const runs = await listGenRuns(); return NextResponse.json({ runs }); }
  return NextResponse.json({ error: 'acción no válida' }, { status: 400 });
}
