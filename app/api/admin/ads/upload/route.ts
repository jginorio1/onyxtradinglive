import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'ad-partners';

// POST (multipart) · sube una imagen (logo o banner de un socio del directorio)
// a NUESTRO storage y devuelve la URL pública. Solo admin. Sin validación de
// tamaño de slot: los banners de brokers vienen en tamaños variados.
export async function POST(req: Request) {
  const { ok } = await requirePerm('planes', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
    if (file.size > 3 * 1024 * 1024) return NextResponse.json({ error: 'La imagen supera 3 MB.' }, { status: 400 });
    if (!/^image\//.test(file.type)) return NextResponse.json({ error: 'Sube una imagen (PNG, JPG, GIF o WebP).' }, { status: 400 });

    try { await supabaseAdmin.storage.createBucket(BUCKET, { public: true }); } catch { /* ya existe */ }
    const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '') || 'png';
    const path = `partners/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, { contentType: file.type, upsert: false });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ ok: true, url: pub.publicUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
