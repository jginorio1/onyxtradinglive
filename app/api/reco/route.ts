import { NextResponse } from 'next/server';
import { recoBrokerSettings } from '@/lib/settings';
import { vpsInfo } from '@/lib/botlab';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Público: bróker y VPS recomendados (afiliado) que el admin edita. Lo usa el chat
// para pintar un BADGE con logo cuando la IA menciona el enlace. Solo datos públicos
// (nombre + enlace + si está activo). Sin caché para reflejar cambios al instante.
export async function GET() {
  try {
    const [b, v] = await Promise.all([recoBrokerSettings(), vpsInfo()]);
    return NextResponse.json({
      broker: { enabled: b.enabled !== false, name: (b.name || '').trim(), url: (b.url || '').trim() },
      vps: { enabled: v.on !== false, name: (v.name || '').trim(), url: (v.url || '').trim() },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch {
    return NextResponse.json({ broker: { enabled: false, name: '', url: '' }, vps: { enabled: false, name: '', url: '' } }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
