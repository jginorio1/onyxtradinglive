import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { moderateImage } from '@/lib/academyAI';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Reutiliza el bucket público "academy" (ya existe) bajo el prefijo blog/.
const BUCKET = 'academy';
const OK = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX = 6 * 1024 * 1024;

// POST · sube una imagen del blog (portada o del cuerpo) al Storage y devuelve su URL pública.
// Recibe { name, data } donde data es un data URL base64. Solo editores del blog.
export async function POST(req: Request) {
  try {
    const { ok } = await requirePerm('modulos', 'manage');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    const b = await req.json().catch(() => ({}));
    const name = String(b.name || 'blog').replace(/[^\w.\- ]+/g, '_').slice(0, 80);
    const data = String(b.data || '');
    const m = /^data:([^;]+);base64,(.+)$/s.exec(data);
    if (!m) return NextResponse.json({ error: 'formato inválido' }, { status: 400 });
    const mediaType = m[1];
    if (!OK.includes(mediaType)) return NextResponse.json({ error: 'solo imágenes (png, jpg, webp, gif)' }, { status: 400 });

    const buf = Buffer.from(m[2], 'base64');
    if (buf.byteLength > MAX) return NextResponse.json({ error: 'imagen demasiado grande (máx 6 MB)' }, { status: 400 });

    // Moderación con IA: bloquea contenido sexual/indebido antes de guardar.
    try { const mod = await moderateImage(mediaType, m[2]); if (!mod.safe) return NextResponse.json({ error: 'blocked', message: 'Imagen bloqueada por moderación (contenido no permitido).' }, { status: 400 }); } catch {}

    const path = `blog/${Date.now()}-${name}`;
    const up = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, { contentType: mediaType, upsert: false });
    if (up.error) return NextResponse.json({ error: up.error.message, hint: 'Crea el bucket público "academy" en Supabase → Storage (o corre academy_v2.sql).' }, { status: 500 });

    const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: pub.publicUrl });
  } catch (e: any) {
    await logError('blog_upload', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
