import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'training-media';

// POST (multipart) · sube un video/imagen de una lección al Storage y devuelve
// la URL pública. Para videos grandes conviene usar una URL (YouTube/Vimeo).
export async function POST(req: Request) {
  const { ok } = await requirePerm('equipo', 'edit');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'falta archivo' }, { status: 400 });
  if (file.size > 40 * 1024 * 1024) return NextResponse.json({ error: 'El archivo supera 40 MB. Usa un enlace de video (YouTube/Vimeo).' }, { status: 400 });

  try { await supabaseAdmin.storage.createBucket(BUCKET, { public: true }); } catch { /* ya existe */ }
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
  const path = `lessons/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const raw = Buffer.from(await file.arrayBuffer());
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, raw, { contentType: file.type || 'application/octet-stream', upsert: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;
  // Auto-registrar en la biblioteca de materiales para poder reutilizarlo.
  const kind = (file.type || '').startsWith('video') || /\.(mp4|webm|mov)$/i.test(file.name) ? 'video' : 'doc';
  try { const { saveMaterial } = await import('@/lib/training'); await saveMaterial({ kind, title: file.name, url, size: file.size }); } catch {}
  return NextResponse.json({ ok: true, url, name: file.name, kind });
}
