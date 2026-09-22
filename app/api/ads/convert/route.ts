import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { recordEvent } from '@/lib/ads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET/POST · postback de conversión (CPA). El anunciante llama aquí desde su
// servidor cuando ocurre un registro/fondeo, identificando la campaña por su
// report_token: /api/ads/convert?token=XXXX . Suma una conversión y su costo CPA.
async function handle(token: string) {
  if (!token) return NextResponse.json({ ok: false, error: 'falta token' }, { status: 400 });
  const { data } = await supabaseAdmin.from('ad_campaigns').select('id,pricing_model,status').eq('report_token', token).maybeSingle();
  if (!data) return NextResponse.json({ ok: false, error: 'no encontrado' }, { status: 404 });
  await recordEvent((data as any).id, 'conversion', {});
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  return handle(new URL(req.url).searchParams.get('token') || '');
}
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({} as any));
  const token = b?.token || new URL(req.url).searchParams.get('token') || '';
  return handle(String(token));
}
