import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { AD_SLOTS, IAB_SIZES, getAdsConfig, saveAdsConfig, rateCard, type AdSlot } from '@/lib/ads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PERM = 'planes'; // el área de precios/monetización

// GET · config global + tarifario efectivo + campañas + catálogo de slots + partners + anunciantes.
export async function GET() {
  const { ok } = await requirePerm(PERM, 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const cfg = await getAdsConfig();
  const rates = await rateCard();
  const { data } = await supabaseAdmin.from('ad_campaigns').select('*').order('created_at', { ascending: false }).limit(300);
  const { data: partners } = await supabaseAdmin.from('ad_partners').select('*').order('rank', { ascending: true }).limit(100);
  const { data: advertisers } = await supabaseAdmin.from('ad_advertisers').select('id,email,name,company,kind,balance,status,created_at').order('created_at', { ascending: false }).limit(100);
  const slots = AD_SLOTS.map((s) => ({ key: s.key, es: s.es, en: s.en, size: s.size, page: s.page, unit: s.unit, model: s.model || 'flat' }));
  return NextResponse.json({
    config: { enabled: cfg.enabled, nativeEnabled: cfg.nativeEnabled, autoApprove: cfg.autoApprove, programmatic: cfg.programmatic, riskDisclaimer: cfg.riskDisclaimer, freqCap: cfg.freqCap, partnerFill: cfg.partnerFill },
    rates, slots, sizes: IAB_SIZES, campaigns: data || [], partners: partners || [], advertisers: advertisers || [],
  });
}

// PATCH · guarda config global (on/off, nativo) y/o el tarifario (precio+unidad por slot).
export async function PATCH(req: Request) {
  const { ok } = await requirePerm(PERM, 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const patch: any = {};
  if (typeof b.enabled === 'boolean') patch.enabled = b.enabled;
  if (typeof b.nativeEnabled === 'boolean') patch.nativeEnabled = b.nativeEnabled;
  if (typeof b.autoApprove === 'boolean') patch.autoApprove = b.autoApprove;
  if (typeof b.partnerFill === 'boolean') patch.partnerFill = b.partnerFill;
  if (typeof b.freqCap === 'number') patch.freqCap = Math.max(0, Math.round(b.freqCap));
  if (b.programmatic && typeof b.programmatic === 'object') patch.programmatic = { enabled: b.programmatic.enabled === true, code: String(b.programmatic.code || '').slice(0, 4000) };
  if (b.riskDisclaimer && typeof b.riskDisclaimer === 'object') patch.riskDisclaimer = { es: String(b.riskDisclaimer.es || '').slice(0, 500), en: String(b.riskDisclaimer.en || '').slice(0, 500) };
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
    const st = ['draft', 'pending', 'scheduled', 'active', 'paused', 'rejected', 'ended'].includes(b.status) ? b.status : 'paused';
    await supabaseAdmin.from('ad_campaigns').update({ status: st }).eq('id', b.id);
    return NextResponse.json({ ok: true });
  }

  // --- F3: revisión de artes ---
  if (b.action === 'approve' && b.id) {
    await supabaseAdmin.from('ad_campaigns').update({ status: 'active', reviewed_at: new Date().toISOString(), reviewed_by: 'admin', review_note: '' }).eq('id', b.id);
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'reject' && b.id) {
    await supabaseAdmin.from('ad_campaigns').update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: 'admin', review_note: String(b.review_note || '').slice(0, 300) }).eq('id', b.id);
    return NextResponse.json({ ok: true });
  }

  // --- F6: directorio de partners (CPA) ---
  if (b.entity === 'partner') {
    if (b.action === 'delete' && b.id) { await supabaseAdmin.from('ad_partners').delete().eq('id', b.id); return NextResponse.json({ ok: true }); }
    const prow: any = {
      name: String(b.name || '').slice(0, 120), logo_url: String(b.logo_url || '').slice(0, 400),
      blurb_es: String(b.blurb_es || '').slice(0, 300), blurb_en: String(b.blurb_en || '').slice(0, 300),
      link_url: String(b.link_url || '').slice(0, 500), category: ['broker', 'propfirm', 'tool'].includes(b.category) ? b.category : 'broker',
      geo: String(b.geo || 'all').slice(0, 120) || 'all', cpa_payout: Math.max(0, Number(b.cpa_payout) || 0),
      featured: b.featured === true, rank: Math.max(0, parseInt(b.rank, 10) || 100),
      regulated: String(b.regulated || '').slice(0, 200), status: ['active', 'paused'].includes(b.status) ? b.status : 'active',
    };
    if (!prow.name || !prow.link_url) return NextResponse.json({ error: 'faltan nombre y enlace' }, { status: 400 });
    if (b.id) { await supabaseAdmin.from('ad_partners').update(prow).eq('id', b.id); return NextResponse.json({ ok: true, id: b.id }); }
    const { data, error } = await supabaseAdmin.from('ad_partners').insert(prow).select('id').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: (data as any)?.id });
  }

  // Crear / editar campaña
  const row: any = {
    advertiser: String(b.advertiser || '').slice(0, 120),
    contact: String(b.contact || '').slice(0, 160),
    slot_key: String(b.slot_key || ''),
    creative_url: String(b.creative_url || '').slice(0, 500),
    creative_path: String(b.creative_path || '').slice(0, 300),
    link_url: String(b.link_url || '').slice(0, 500),
    alt: String(b.alt || '').slice(0, 300),
    lang: ['all', 'es', 'en'].includes(b.lang) ? b.lang : 'all',
    geo: String(b.geo || 'all').slice(0, 120) || 'all',
    geo_tier: ['t1', 't2', 't3'].includes(b.geo_tier) ? b.geo_tier : '',
    geo_exclude: String(b.geo_exclude || '').slice(0, 120),
    device: ['all', 'desktop', 'mobile'].includes(b.device) ? b.device : 'all',
    category: ['broker', 'propfirm', 'tool', 'education', 'general'].includes(b.category) ? b.category : 'general',
    disclaimer: b.disclaimer === true,
    pricing_model: ['flat', 'cpm', 'cpc', 'cpa'].includes(b.pricing_model) ? b.pricing_model : 'flat',
    budget: Math.max(0, Number(b.budget) || 0),
    daily_cap: Math.max(0, Number(b.daily_cap) || 0),
    starts_at: b.starts_at ? new Date(b.starts_at).toISOString() : null,
    ends_at: b.ends_at ? new Date(b.ends_at).toISOString() : null,
    weight: Math.max(1, parseInt(b.weight, 10) || 1),
    price: Math.max(0, Number(b.price) || 0),
    status: ['draft', 'pending', 'scheduled', 'active', 'paused', 'rejected', 'ended'].includes(b.status) ? b.status : 'draft',
  };
  if (!AD_SLOTS.some((s) => s.key === row.slot_key)) return NextResponse.json({ error: 'slot inválido' }, { status: 400 });

  if (b.id) { await supabaseAdmin.from('ad_campaigns').update(row).eq('id', b.id); return NextResponse.json({ ok: true, id: b.id }); }
  const { data, error } = await supabaseAdmin.from('ad_campaigns').insert(row).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: (data as any)?.id });
}
