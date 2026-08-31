import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'account-files';
const MAX = 8 * 1024 * 1024;
// Solo imagenes y PDF. Evita que se use el bucket publico como alojamiento de cualquier cosa.
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'application/pdf'];
const OK_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'pdf'];

// POST (multipart) · subida generica (comprobantes, certificados...). Devuelve la URL publica.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const form = await req.formData().catch(() => null);
    const file = form?.get('file') as File | null;
    if (!file || typeof file === 'string' || !file.size) {
      return NextResponse.json({ error: 'File missing.', code: 'file_missing' }, { status: 400 });
    }
    if (file.size > MAX) {
      return NextResponse.json({ error: 'File is larger than 8 MB.', code: 'file_big' }, { status: 400 });
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const type = (file.type || '').toLowerCase();
    if (!OK_EXT.includes(ext) || (type && !OK_TYPES.includes(type))) {
      return NextResponse.json({ error: 'Only images or PDF are allowed.', code: 'file_type' }, { status: 400 });
    }

    try { await supabaseAdmin.storage.createBucket(BUCKET, { public: true }); } catch { /* ya existe */ }

    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());

    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, {
      contentType: type || 'application/octet-stream', upsert: false,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ ok: true, url: pub.publicUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
