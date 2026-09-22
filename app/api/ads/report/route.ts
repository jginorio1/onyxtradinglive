import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { slotByKey } from '@/lib/ads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · reporte público de una campaña por su token (para el anunciante).
// ?format=csv devuelve un CSV descargable. Sin datos sensibles del negocio.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  if (!token) return NextResponse.json({ error: 'falta token' }, { status: 400 });
  const { data } = await supabaseAdmin.from('ad_campaigns')
    .select('advertiser,slot_key,impressions,clicks,starts_at,ends_at,status').eq('report_token', token).maybeSingle();
  if (!data) return NextResponse.json({ error: 'no encontrado' }, { status: 404 });
  const c: any = data;
  const slot = slotByKey(c.slot_key);
  const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
  const payload = {
    advertiser: c.advertiser, slot: slot ? `${slot.es} · ${slot.size}` : c.slot_key,
    impressions: c.impressions, clicks: c.clicks, ctr: Number(ctr.toFixed(2)),
    starts_at: c.starts_at, ends_at: c.ends_at, status: c.status,
  };

  if (url.searchParams.get('format') === 'csv') {
    const csv = [
      'metric,value',
      `advertiser,"${String(c.advertiser).replace(/"/g, '""')}"`,
      `space,"${payload.slot}"`,
      `impressions,${c.impressions}`,
      `clicks,${c.clicks}`,
      `ctr_percent,${payload.ctr}`,
      `starts_at,${c.starts_at || ''}`,
      `ends_at,${c.ends_at || ''}`,
      `status,${c.status}`,
    ].join('\n');
    return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="onyx-ad-report.csv"' } });
  }
  return NextResponse.json(payload, { headers: { 'cache-control': 'no-store' } });
}
