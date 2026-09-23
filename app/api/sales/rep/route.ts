import { NextResponse } from 'next/server';
import { repPublicProfile } from '@/lib/salesKit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Público: perfil del vendedor para el banner personalizado del landing (?sv=CODE).
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code') || '';
  if (!code) return NextResponse.json({ ok: false });
  try {
    const p = await repPublicProfile(code);
    if (!p) return NextResponse.json({ ok: false });
    return NextResponse.json({ ok: true, ...p });
  } catch { return NextResponse.json({ ok: false }); }
}
