import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'trade-photos';

// POST (multipart) · sube la foto de una operación a Supabase Storage y devuelve la URL pública.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const tradeId = String(form.get('trade_id') || '');
  if (!file || !tradeId) return NextResponse.json({ error: 'falta archivo o trade_id' }, { status: 400 });
  if (file.size > 6 * 1024 * 1024) return NextResponse.json({ error: 'la imagen supera 6 MB' }, { status: 400 });

  // Crear el bucket si no existe (idempotente)
  try { await supabaseAdmin.storage.createBucket(BUCKET, { public: true }); } catch { /* ya existe */ }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${user.id}/${tradeId}-${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, {
    contentType: file.type || 'image/jpeg', upsert: true,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;

  // Guardar la URL en el diario de esa operación
  await supabaseAdmin.from('trade_journal').upsert(
    { user_id: user.id, trade_id: tradeId, image_url: url, updated_at: new Date().toISOString() },
    { onConflict: 'trade_id' }
  );

  return NextResponse.json({ ok: true, url });
}
