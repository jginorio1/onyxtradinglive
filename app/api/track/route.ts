import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { visitorId, recordVisit, refName, looksLikeBot } from '@/lib/visitors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Beacon público: cada carga de página pública manda un ping aquí. Barato y
// silencioso. Deriva la identidad anónima del visitante en el servidor a partir
// de IP + navegador (nunca se guardan), añade país (cabecera de Vercel) y registra.
export async function POST(req: Request) {
  try {
    const h = headers();
    const ua = h.get('user-agent') || '';
    if (looksLikeBot(ua)) return new NextResponse(null, { status: 204 }); // no contamos bots

    const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || '0.0.0.0';
    const country = h.get('x-vercel-ip-country') || h.get('cf-ipcountry') || '';
    const host = (h.get('host') || 'onyxtradinglive.com').toLowerCase();

    const b = await req.json().catch(() => ({} as any));
    let path = String(b.path || '/').split('?')[0].slice(0, 200);
    if (/^\/(admin|api)/.test(path)) return new NextResponse(null, { status: 204 }); // el panel no es "tráfico"
    const ref = refName(String(b.ref || ''), host);

    await recordVisit({ vid: visitorId(ip, ua), path, ref, country });
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
