import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { getAdmin } from '@/lib/admin';
import { productDownloadUrl } from '@/lib/botlab';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · descarga PROTEGIDA del archivo de un robot. Solo con licencia activa
// (o si eres el creador / admin). Devuelve una URL firmada temporal del bucket
// privado 'bot-files'. ?id=<productId>
export async function GET(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
  let isAdmin = false;
  try { isAdmin = (await getAdmin()).isAdmin; } catch {}
  const r = await productDownloadUrl(user.id, id, isAdmin);
  if (r.error) return NextResponse.json({ error: r.error }, { status: 403 });
  return NextResponse.json({ url: r.url, name: r.name });
}
