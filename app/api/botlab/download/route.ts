import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { getAdmin } from '@/lib/admin';
import { productDownloadUrl, productBuildFile } from '@/lib/botlab';
import { logDelivery, reqMeta } from '@/lib/evidence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · descarga PROTEGIDA del archivo de un robot. Solo con licencia activa
// (o si eres el creador / admin).
//   · source='upload' → URL firmada temporal del bucket privado 'bot-files'.
//   · source='build'  → archivo GENERADO al vuelo con el candado, para la
//     plataforma pedida (?platform=mt5|mt4|ctrader). Se entrega como adjunto.
// ?id=<productId>&platform=<mt5|mt4|ctrader>
export async function GET(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || '';
  const platform = (url.searchParams.get('platform') || '').toLowerCase();
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
  let isAdmin = false;
  try { isAdmin = (await getAdmin()).isAdmin; } catch {}

  // Modelo A · robot del constructor: se pide una plataforma → generamos el archivo.
  if (platform) {
    const SITE = (process.env.NEXT_PUBLIC_APP_URL || url.origin || 'https://www.onyxtradinglive.com').replace(/\/$/, '');
    const g = await productBuildFile(user.id, id, platform, SITE, isAdmin);
    if (g.error) return NextResponse.json({ error: g.error }, { status: 403 });
    if (!isAdmin) { const { ip, ua } = reqMeta(req); await logDelivery({ userId: user.id, productId: id, ip, ua, what: `Descargó el robot (${platform})` }); }
    return new NextResponse(g.code!, {
      headers: { 'content-type': g.contentType || 'text/plain; charset=utf-8', 'content-disposition': `attachment; filename="${g.name}"` },
    });
  }

  // Modelo B · archivo externo subido.
  const r = await productDownloadUrl(user.id, id, isAdmin);
  if (r.error) return NextResponse.json({ error: r.error }, { status: 403 });
  if (!isAdmin) { const { ip, ua } = reqMeta(req); await logDelivery({ userId: user.id, productId: id, ip, ua, what: `Descargó el archivo del robot (${r.name || 'archivo'})` }); }
  return NextResponse.json({ url: r.url, name: r.name });
}
