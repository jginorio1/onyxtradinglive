import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { getSetting, saveSetting } from '@/lib/settings';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Recursos del Centro de Correos: firmas guardadas y subida de imágenes.
//   GET                         → { signatures: [{id,name,html}] }
//   POST action 'save_signatures' → guarda la lista de firmas
//   POST action 'upload_image'    → sube una imagen (base64) y devuelve su URL pública
// Las firmas viven en el ajuste 'email_signatures'. Las imágenes van al bucket
// público "academy" bajo el prefijo email/ (para poder usarlas en los correos: los
// clientes de correo NO pueden mostrar imágenes locales, necesitan una URL pública).

type Sig = { id: string; name: string; html: string };

const BUCKET = 'academy';
const OK = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX = 6 * 1024 * 1024;

export async function GET() {
  const p = await requirePerm('campanas', 'view');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const signatures = await getSetting<Sig[]>('email_signatures', []);
  return NextResponse.json({ signatures: Array.isArray(signatures) ? signatures : [] });
}

export async function POST(req: Request) {
  const p = await requirePerm('campanas', 'manage');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    const action = b.action;

    if (action === 'save_signatures') {
      const list: Sig[] = Array.isArray(b.signatures) ? b.signatures : [];
      const clean = list.slice(0, 30).map((s: any) => ({
        id: String(s?.id || Date.now() + '' + Math.random().toString(36).slice(2, 6)).slice(0, 40),
        name: String(s?.name || 'Firma').replace(/[<>]/g, '').slice(0, 80),
        html: String(s?.html || '').slice(0, 8000),
      }));
      await saveSetting('email_signatures', clean);
      return NextResponse.json({ ok: true, signatures: clean });
    }

    if (action === 'upload_image') {
      const name = String(b.name || 'email').replace(/[^\w.\- ]+/g, '_').slice(0, 80);
      const data = String(b.data || '');
      const m = /^data:([^;]+);base64,(.+)$/s.exec(data);
      if (!m) return NextResponse.json({ error: 'formato inválido' }, { status: 400 });
      const mediaType = m[1];
      if (!OK.includes(mediaType)) return NextResponse.json({ error: 'solo imágenes (png, jpg, webp, gif)' }, { status: 400 });
      const buf = Buffer.from(m[2], 'base64');
      if (buf.byteLength > MAX) return NextResponse.json({ error: 'imagen demasiado grande (máx 6 MB)' }, { status: 400 });
      const path = `email/${Date.now()}-${name}`;
      const up = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, { contentType: mediaType, upsert: false });
      if (up.error) return NextResponse.json({ error: up.error.message, hint: 'Crea el bucket público "academy" en Supabase → Storage.' }, { status: 500 });
      const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
      return NextResponse.json({ url: pub.publicUrl });
    }

    return NextResponse.json({ error: 'acción desconocida' }, { status: 400 });
  } catch (e: any) {
    await logError('emails_assets', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
