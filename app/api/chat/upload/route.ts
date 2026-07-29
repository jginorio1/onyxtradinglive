import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'chat-uploads';
const OK_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf',
  'text/plain', 'text/csv', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const MAX = 8 * 1024 * 1024;

// POST · sube una foto o documento del chat al Storage y devuelve su URL pública.
// Lo usan por igual el trader (soporte) y los empleados (chat de equipo): basta
// con estar autenticado. El archivo llega como data URL base64.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

    const b = await req.json().catch(() => ({}));
    const name = String(b.name || 'archivo').replace(/[^\w.\- ]+/g, '_').slice(0, 80);
    const type = String(b.type || '');
    const data = String(b.data || '');
    const m = /^data:([^;]+);base64,(.+)$/s.exec(data);
    if (!m) return NextResponse.json({ error: 'formato inválido' }, { status: 400 });
    const mediaType = m[1] || type;
    if (!OK_TYPES.includes(mediaType)) return NextResponse.json({ error: 'tipo de archivo no permitido' }, { status: 400 });

    const buf = Buffer.from(m[2], 'base64');
    if (buf.byteLength > MAX) return NextResponse.json({ error: 'archivo demasiado grande (máx 8 MB)' }, { status: 400 });

    const path = `${user.id}/${Date.now()}-${name}`;
    const up = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, { contentType: mediaType, upsert: false });
    if (up.error) return NextResponse.json({ error: up.error.message, hint: 'Crea el bucket público "chat-uploads" en Supabase → Storage.' }, { status: 500 });

    const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: pub.publicUrl, name, type: mediaType, size: buf.byteLength });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
