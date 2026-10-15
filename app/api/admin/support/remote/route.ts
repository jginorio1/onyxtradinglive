import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { getSetting, saveSetting } from '@/lib/settings';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Soporte remoto DE PAGO (toggle + precio configurable).
// Guardado en app_settings bajo 'remote_support'. La burbuja/soporte ofrece
// una sesión remota pagada (pago único por Stripe) cuando está encendido.
// ============================================================
export type RemoteSupport = {
  on: boolean;          // encendido/apagado
  price: number;        // USD por sesión
  minutes: number;      // duración estimada
  tool: string;         // herramienta (AnyDesk / TeamViewer…)
  link: string;         // enlace de descarga de la herramienta
  note_es: string;      // instrucción corta para el cliente (ES)
  note_en: string;      // instrucción corta para el cliente (EN)
};

export const REMOTE_DEFAULT: RemoteSupport = {
  on: false, price: 25, minutes: 30, tool: 'AnyDesk',
  link: 'https://anydesk.com/download',
  note_es: 'Descarga AnyDesk, ábrelo y comparte con el agente el código de 9 dígitos que te muestra. No cierres la ventana durante la sesión.',
  note_en: 'Download AnyDesk, open it and share the 9-digit code it shows with the agent. Keep the window open during the session.',
};

export async function GET() {
  try {
    const { ok } = await requirePerm('soporte', 'view');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const cfg = await getSetting<RemoteSupport>('remote_support', REMOTE_DEFAULT);
    return NextResponse.json({ ...REMOTE_DEFAULT, ...cfg });
  } catch (e: any) {
    await logError('support_remote', e);
    return NextResponse.json({ ...REMOTE_DEFAULT });
  }
}

export async function POST(req: Request) {
  try {
    const g = await requirePerm('soporte', 'manage');
    if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const b = await req.json().catch(() => ({} as any));
    const cur = await getSetting<RemoteSupport>('remote_support', REMOTE_DEFAULT);
    const next: RemoteSupport = {
      on: b.on !== undefined ? !!b.on : cur.on,
      price: b.price !== undefined ? Math.max(0, Math.round(Number(b.price) || 0)) : cur.price,
      minutes: b.minutes !== undefined ? Math.max(5, Math.round(Number(b.minutes) || 30)) : cur.minutes,
      tool: b.tool !== undefined ? String(b.tool).slice(0, 40) : cur.tool,
      link: b.link !== undefined ? String(b.link).slice(0, 300) : cur.link,
      note_es: b.note_es !== undefined ? String(b.note_es).slice(0, 600) : cur.note_es,
      note_en: b.note_en !== undefined ? String(b.note_en).slice(0, 600) : cur.note_en,
    };
    await saveSetting('remote_support', next);
    await logAdmin(g.user?.email || '', 'remote_support', 'remote_support', { on: next.on, price: next.price });
    return NextResponse.json({ ok: true, ...next });
  } catch (e: any) {
    await logError('support_remote', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
