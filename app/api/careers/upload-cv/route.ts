import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'careers-cv';
const MAX = 5 * 1024 * 1024; // 5 MB

// POST público · sube el CV (PDF) del candidato a un bucket PRIVADO y devuelve la ruta.
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const name = String(b.name || 'cv').replace(/[^\w.\- ]+/g, '_').slice(0, 80);
    const data = String(b.data || '');
    const m = /^data:([^;]+);base64,(.+)$/s.exec(data);
    if (!m) return NextResponse.json({ error: 'formato inválido' }, { status: 400 });
    if (m[1] !== 'application/pdf') return NextResponse.json({ error: 'Solo PDF' }, { status: 400 });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.byteLength > MAX) return NextResponse.json({ error: 'PDF demasiado grande (máx 5 MB)' }, { status: 400 });
    const path = `applications/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name}`;
    const up = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, { contentType: 'application/pdf', upsert: false });
    if (up.error) return NextResponse.json({ error: up.error.message, hint: 'Crea el bucket privado "careers-cv" (corre careers_v1.sql).' }, { status: 500 });
    return NextResponse.json({ ok: true, path });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
