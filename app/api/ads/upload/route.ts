import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { validateCreative, slotByKey } from '@/lib/ads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'ad-creatives';

// POST (multipart) · el anunciante sube el arte a NUESTRO storage. Validamos el
// tamaño exacto del slot (IAB) y el peso. Devuelve la URL pública y las
// dimensiones. El arte queda alojado por nosotros (congelado): no se puede
// cambiar después de aprobado. No se activa nada aquí; solo se guarda el archivo.
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const slotKey = String(form.get('slot') || '');
    if (!file) return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
    if (!slotByKey(slotKey)) return NextResponse.json({ error: 'Ubicación inválida.' }, { status: 400 });
    if (file.size > 1.5 * 1024 * 1024) return NextResponse.json({ error: 'El arte supera 1.5 MB.' }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const v = validateCreative(slotKey, buf);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    try { await supabaseAdmin.storage.createBucket(BUCKET, { public: true }); } catch { /* ya existe */ }
    const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '') || 'png';
    const path = `${slotKey}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, { contentType: file.type || 'image/png', upsert: false });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ ok: true, url: pub.publicUrl, path, w: v.w, h: v.h });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
