import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · redirección de salida de un partner del directorio (CPA). Cuenta el clic
// y manda al enlace afiliado con rel de salida. /api/ads/partner?id=UUID
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id) return NextResponse.redirect(new URL('/socios', req.url));
  const { data } = await supabaseAdmin.from('ad_partners').select('link_url,status').eq('id', id).maybeSingle();
  const link = (data as any)?.link_url;
  if (!link || (data as any)?.status !== 'active') return NextResponse.redirect(new URL('/socios', req.url));
  try { await supabaseAdmin.rpc('ad_partner_bump', { p_id: id, p_kind: 'click' }); } catch {}
  return NextResponse.redirect(link);
}

// POST · postback de registro (signup) de un partner. /api/ads/partner con {id}
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({} as any));
    if (b?.id) await supabaseAdmin.rpc('ad_partner_bump', { p_id: String(b.id), p_kind: 'signup' });
  } catch {}
  return NextResponse.json({ ok: true });
}
