import { NextResponse } from 'next/server';
import { getAdmin, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { saveDataset } from '@/lib/factory';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function canManage(role: string | null, perms: any) {
  return role === 'owner' || perms?.modulos === 'manage';
}

const BUCKET = 'factory-data';

// POST (multipart) · guarda un dataset validado + sube sus barras OHLC reutilizables
// a Storage. El cliente manda `bars` (JSON columnar) y `meta` (métricas + fuente).
export async function POST(req: Request) {
  const { user, isAdmin, role, perms } = await getAdmin();
  if (!isAdmin || !canManage(role, perms)) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: 'formato inválido' }, { status: 400 }); }
  const barsFile = form.get('bars') as File | null;
  let meta: any = {};
  try { meta = JSON.parse(String(form.get('meta') || '{}')); } catch {}
  const metrics = meta.metrics || {};
  if (!metrics.rows) return NextResponse.json({ error: 'faltan métricas del dataset' }, { status: 400 });

  // Sube las barras OHLC (si vienen) a la biblioteca.
  let barsPath: string | undefined, barsUrl: string | undefined;
  if (barsFile && barsFile.size > 0) {
    try { await supabaseAdmin.storage.createBucket(BUCKET, { public: true }); } catch { /* ya existe */ }
    const buf = Buffer.from(await barsFile.arrayBuffer());
    const path = `${user.id}/${Date.now()}-${(meta.symbol || 'data').replace(/[^A-Za-z0-9]/g, '')}.json`;
    const up = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, { contentType: 'application/json', upsert: true });
    if (up.error) return NextResponse.json({ error: 'no se pudieron guardar las barras: ' + up.error.message }, { status: 500 });
    barsPath = path;
    barsUrl = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  try {
    const r = await saveDataset({
      userId: user.id, symbol: meta.symbol || '', timeframe: meta.timeframe || '', filename: meta.filename || '',
      metrics, source: meta.source, broker: meta.broker,
      barsPath, barsUrl, barsTf: meta.barsTf, barsCount: meta.barsCount, fileSize: meta.fileSize,
    });
    await logAdmin(user.email || '', 'factory_dataset', r.dataset?.id || '', { verdict: r.quality.verdict, score: r.quality.score, source: meta.source });
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 400 });
  }
}
