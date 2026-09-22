import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { AD_SLOTS, getAdsConfig, saveAdsConfig, rateCard, type AdSlot } from '@/lib/ads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PERM = 'planes'; // el área de precios/monetización

// GET · config global + tarifario efectivo + campañas + catálogo de slots.
export async function GET() {
  const { ok } = await requirePerm(PERM, 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const cfg = await getAdsConfig();
  const rates = await rateCard();
  const { data } = await supabaseAdmin.from('ad_campaigns').select('*').order('created_at', { ascending: false }).limit(200);
  const slots = AD_SLOTS.map((s) => ({ key: s.key, es: s.es, en: s.en, size: s.size, page: s.page }));
  return NextResponse.json({ config: { enabled: cfg.enabled, nativeEnabled: cfg.nativeEnabled }, rates, slots, campaigns: data || [] });
}

// PATCH · guarda config global (on/off, nativo) y/o el tarifario (precio+unidad por slot).
export async function PATCH(req: Request) {
  const { ok } = await requirePerm(PERM, 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const patch: any = {};
  if (typeof b.enabled === 'boolean') patch.enabled = b.enabled;
  if (typeof b.nativeEnabled === 'boolean') patch.nativeEnabled = b.nativeEnabled;
  if (b.rates && typeof b.rates === 'object') {
    const clean: Record<string, { price: number; unit: AdSlot['unit'] }> = {};
    for (const s of AD_SLOTS) {
      const r = b.rates[s.key];
      if (r) clean[s.key] = { price: Math.max(0, Number(r.price) || 0), unit: (['week', 'month', 'cpm'].includes(r.unit) ? r.unit : s.unit) };
    }
    patch.rates = clean;
  }
  await saveAdsConfig(patch);
  return NextResponse.json({ ok: true });
}

// POST · crea/actualiza una campaña o ejecuta una acción (activar/pausar/borrar).
export async function POST(req: Request) {
  const { ok } = await requirePerm(PERM, 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));

  if (b.action === 'delete' && b.id) {
    await supabaseAdmin.from('ad_campaigns').delete().eq('id', b.id);
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'status' && b.id) {
    const st = ['draft', 'scheduled', 'active', 'paused', 'ended'].includes(b.status) ? b.status : 'paused';
    await supabaseAdmin.from('ad_campaigns').update({ status: st }).eq('id', b.id);
    return NextResponse.json({ ok: true });
  }

  // Crear / editar
  const row: any = {
    advertiser: String(b.advertiser || '').slice(0, 120),
    contact: String(b.contact || '').slice(0, 160),
    slot_key: String(b.slot_key || ''),
    creative_url: String(b.creative_url || '').slice(0, 500),
    link_url: String(b.link_url || '').slice(0, 500),
    alt: String(b.alt || '').slice(0, 300),
    lang: ['all', 'es', 'en'].includes(b.lang) ? b.lang : 'all',
    starts_at: b.starts_at ? new Date(b.starts_at).toISOString() : null,
    ends_at: b.ends_at ? new Date(b.ends_at).toISOString() : null,
    weight: Math.max(1, parseInt(b.weight, 10) || 1),
    price: Math.max(0, Number(b.price) || 0),
    status: ['draft', 'scheduled', 'active', 'paused', 'ended'].includes(b.status) ? b.status : 'draft',
  };
  if (!AD_SLOTS.some((s) => s.key === row.slot_key)) return NextResponse.json({ error: 'slot inválido' }, { status: 400 });

  if (b.id) { await supabaseAdmin.from('ad_campaigns').update(row).eq('id', b.id); return NextResponse.json({ ok: true, id: b.id }); }
  const { data, error } = await supabaseAdmin.from('ad_campaigns').insert(row).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: (data as any)?.id });
}
