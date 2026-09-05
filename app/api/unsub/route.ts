import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Baja de correos de marketing por token (un clic desde el pie del correo).
// No exige sesión: el token del enlace es la autenticación. Solo apaga el
// marketing; los correos transaccionales (facturación, soporte) siguen.
async function unsubscribe(token: string): Promise<boolean> {
  if (!token) return false;
  const { data } = await supabaseAdmin.from('profiles').select('id').eq('unsub_token', token).maybeSingle();
  if (!(data as any)?.id) return false;
  await supabaseAdmin.from('profiles').update({ marketing_emails: false }).eq('id', (data as any).id);
  return true;
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('u') || '';
  const ok = await unsubscribe(token);
  return NextResponse.json({ ok });
}

// Re-suscribirse (por si se dio de baja sin querer).
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({} as any));
  const token = b.u || '';
  if (!token) return NextResponse.json({ ok: false }, { status: 400 });
  const { data } = await supabaseAdmin.from('profiles').select('id').eq('unsub_token', token).maybeSingle();
  if (!(data as any)?.id) return NextResponse.json({ ok: false }, { status: 404 });
  await supabaseAdmin.from('profiles').update({ marketing_emails: true }).eq('id', (data as any).id);
  return NextResponse.json({ ok: true });
}
