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
    .select('id,advertiser,slot_key,impressions,clicks,conversions,starts_at,ends_at,status,pricing_model,spent,budget').eq('report_token', token).maybeSingle();
  if (!data) return NextResponse.json({ error: 'no encontrado' }, { status: 404 });
  const c: any = data;
  const slot = slotByKey(c.slot_key);
  const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
  // Desglose diario (F5): impresiones/vistas/clics/conversiones por día.
  const { data: daily } = await supabaseAdmin.from('ad_stats_daily')
    .select('day,impressions,views,clicks,conversions,spend').eq('campaign_id', c.id).order('day', { ascending: false }).limit(90);
  const payload = {
    advertiser: c.advertiser, slot: slot ? `${slot.es} · ${slot.size}` : c.slot_key,
    impressions: c.impressions, clicks: c.clicks, conversions: c.conversions || 0, ctr: Number(ctr.toFixed(2)),
    pricing_model: c.pricing_model || 'flat', spent: c.spent || 0, budget: c.budget || 0,
    starts_at: c.starts_at, ends_at: c.ends_at, status: c.status, daily: daily || [],
  };

  if (url.searchParams.get('format') === 'csv') {
    const head = [
      'metric,value',
      `advertiser,"${String(c.advertiser).replace(/"/g, '""')}"`,
      `space,"${payload.slot}"`,
      `impressions,${c.impressions}`,
      `clicks,${c.clicks}`,
      `conversions,${payload.conversions}`,
      `ctr_percent,${payload.ctr}`,
      `pricing_model,${payload.pricing_model}`,
      `spent_usd,${payload.spent}`,
      `starts_at,${c.starts_at || ''}`,
      `ends_at,${c.ends_at || ''}`,
      `status,${c.status}`,
      '',
      'day,impressions,views,clicks,conversions,spend',
    ];
    for (const d of (payload.daily as any[])) head.push(`${d.day},${d.impressions},${d.views},${d.clicks},${d.conversions},${d.spend}`);
    const csv = head.join('\n');
    return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="onyx-ad-report.csv"' } });
  }
  return NextResponse.json(payload, { headers: { 'cache-control': 'no-store' } });
}
