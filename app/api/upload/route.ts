import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'account-files';

// POST (multipart) · subida genérica (comprobantes, certificados…). Devuelve la URL pública.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'File missing.', code: 'file_missing' }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'File is larger than 8 MB.', code: 'file_big' }, { status: 400 });

  try { await supabaseAdmin.storage.createBucket(BUCKET, { public: true }); } catch { /* ya existe */ }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${user.id}/${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: pub.publicUrl });
}
