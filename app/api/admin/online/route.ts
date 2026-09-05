import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { getSetting, saveSetting, onlineNowSettings, type OnlineNow } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const oneOf = <T extends string>(v: any, allowed: T[], fb: T): T => (allowed.includes(v) ? v : fb);
const clampInt = (v: any, lo: number, hi: number, fb: number) => {
  const n = Math.round(Number(v));
  return isNaN(n) ? fb : Math.min(hi, Math.max(lo, n));
};

// GET · ajustes de la burbuja "en línea ahora".
export async function GET() {
  const { ok } = await requirePerm('ajustes', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  return NextResponse.json(await onlineNowSettings());
}

// PATCH · guardar (owner).
export async function PATCH(req: Request) {
  const { ok } = await requirePerm('ajustes', 'manage');
  if (!ok) return NextResponse.json({ error: 'Solo el Owner puede editar esto.' }, { status: 403 });
  const prev = await getSetting<OnlineNow>('online_now', await onlineNowSettings());
  const b = await req.json().catch(() => ({} as any));

  let min = clampInt(b.min, 0, 1_000_000, prev.min);
  let max = clampInt(b.max, 1, 1_000_000, prev.max);
  if (max <= min) max = min + 1;

  const value: OnlineNow = {
    enabled: b.enabled == null ? prev.enabled : !!b.enabled,
    min, max,
    speed: oneOf(b.speed, ['slow', 'normal', 'fast'], prev.speed),
    color: /^#[0-9a-f]{6}$/i.test(String(b.color || '')) ? String(b.color) : prev.color,
    hideMobile: b.hideMobile == null ? prev.hideMobile : !!b.hideMobile,
    label_es: String(b.label_es ?? prev.label_es).slice(0, 40),
    label_en: String(b.label_en ?? prev.label_en).slice(0, 40),
  };
  await saveSetting('online_now', value);
  return NextResponse.json({ ok: true, ...value });
}
