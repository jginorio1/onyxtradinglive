import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { AD_SLOTS, IAB_SIZES, getAdsConfig, saveAdsConfig, rateCard, type AdSlot } from '@/lib/ads';
import { getMediaKitOverrides, saveMediaKitOverrides, createProposal, listProposals, deleteProposal, markProposalSent, getProposalByToken, proposalUrl } from '@/lib/mediakit';
import { sendEmail, mailEnabled } from '@/lib/mail';
import { mailRoutes, fromLine } from '@/lib/settings';

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
  const mediakit = await getMediaKitOverrides();
  const proposals = await listProposals(100);
  return NextResponse.json({
    config: { enabled: cfg.enabled, nativeEnabled: cfg.nativeEnabled, autoApprove: cfg.autoApprove, programmatic: cfg.programmatic, riskDisclaimer: cfg.riskDisclaimer, freqCap: cfg.freqCap, partnerFill: cfg.partnerFill },
    rates, slots, sizes: IAB_SIZES, campaigns: data || [], partners: partners || [], advertisers: advertisers || [], mediakit, proposals,
    mailReady: mailEnabled(),
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

  // Media Kit · guarda los textos/pisos/paquetes editables de la propuesta.
  if (b.entity === 'mediakit') {
    const d = b.data || {};
    const patch: any = {};
    const str = (v: any, n = 2000) => String(v ?? '').slice(0, n);
    const num = (v: any) => Math.max(0, Number(v) || 0);
    if (typeof d.headlineEs === 'string') patch.headlineEs = str(d.headlineEs, 300);
    if (typeof d.headlineEn === 'string') patch.headlineEn = str(d.headlineEn, 300);
    if (typeof d.aboutEs === 'string') patch.aboutEs = str(d.aboutEs);
    if (typeof d.aboutEn === 'string') patch.aboutEn = str(d.aboutEn);
    if (typeof d.audienceEs === 'string') patch.audienceEs = str(d.audienceEs, 600);
    if (typeof d.audienceEn === 'string') patch.audienceEn = str(d.audienceEn, 600);
    if (typeof d.contactEmail === 'string') patch.contactEmail = str(d.contactEmail, 120);
    if (typeof d.showPrices === 'boolean') patch.showPrices = d.showPrices;
    if (d.floorVisitors != null) patch.floorVisitors = num(d.floorVisitors);
    if (d.floorPageviews != null) patch.floorPageviews = num(d.floorPageviews);
    if (typeof d.avgTime === 'string') patch.avgTime = str(d.avgTime, 12);
    if (d.mobilePct != null) patch.mobilePct = Math.min(100, num(d.mobilePct));
    if (d.ctrPctFloor != null) patch.ctrPctFloor = num(d.ctrPctFloor);
    if (Array.isArray(d.packages)) {
      patch.packages = d.packages.slice(0, 8).map((p: any) => ({
        id: str(p.id, 40) || 'pkg', es: str(p.es, 60), en: str(p.en, 60),
        priceMonthly: num(p.priceMonthly),
        descEs: str(p.descEs, 300), descEn: str(p.descEn, 300),
        slots: Array.isArray(p.slots) ? p.slots.map((x: any) => str(x, 40)).slice(0, 12) : [],
      }));
    }
    const saved = await saveMediaKitOverrides(patch);
    return NextResponse.json({ ok: true, mediakit: saved });
  }

  // Propuestas personalizadas por cliente: crear / borrar / enviar por email.
  if (b.entity === 'proposal') {
    if (b.action === 'delete' && b.id) {
      await deleteProposal(b.id);
      return NextResponse.json({ ok: true, proposals: await listProposals(100) });
    }
    if (b.action === 'create') {
      const p = await createProposal({
        company: b.company, contact: b.contact, email: b.email,
        packageId: b.packageId, noteEs: b.noteEs, noteEn: b.noteEn, lang: b.lang,
      });
      if (!p) return NextResponse.json({ error: 'No se pudo crear.' }, { status: 500 });
      return NextResponse.json({ ok: true, proposal: p, url: proposalUrl(p.token, p.lang), proposals: await listProposals(100) });
    }
    if (b.action === 'send' && b.id) {
      const p = await getProposalByToken(b.token || '');
      // buscamos por id si no vino token
      const target = p || (await listProposals(100)).find((x) => x.id === b.id) || null;
      if (!target) return NextResponse.json({ error: 'Propuesta no encontrada.' }, { status: 404 });
      if (!target.email) return NextResponse.json({ error: 'La propuesta no tiene email de cliente.' }, { status: 400 });
      if (!mailEnabled()) return NextResponse.json({ error: 'El correo no está configurado (falta RESEND_API_KEY).' }, { status: 400 });

      const es = target.lang !== 'en';
      const url = proposalUrl(target.token, target.lang);
      const routes = await mailRoutes().catch(() => null as any);
      const from = routes ? fromLine(routes) : undefined;
      const subject = es
        ? `Propuesta de publicidad · Onyx Trading Live${target.company ? ' · ' + target.company : ''}`
        : `Advertising proposal · Onyx Trading Live${target.company ? ' · ' + target.company : ''}`;
      const greet = target.contact ? (es ? `Hola ${target.contact},` : `Hi ${target.contact},`) : (es ? 'Hola,' : 'Hi,');
      const note = (es ? target.note_es : target.note_en) || '';
      const body = es
        ? `${greet}\n\nPreparé una propuesta de publicidad para ${target.company || 'ustedes'} con nuestras estadísticas reales, el inventario y los paquetes.\n\n${note ? note + '\n\n' : ''}Puedes verla y descargarla en PDF aquí:\n${url}\n\nQuedo atento a tus comentarios.\n\nOnyx Trading Live · Publicidad`
        : `${greet}\n\nI prepared an advertising proposal for ${target.company || 'you'} with our real stats, inventory and packages.\n\n${note ? note + '\n\n' : ''}You can view it and download it as PDF here:\n${url}\n\nLooking forward to your feedback.\n\nOnyx Trading Live · Advertising`;

      const ok = await sendEmail(target.email, subject, body, { from, kind: 'ad_proposal', replyTo: routes?.support });
      if (!ok) return NextResponse.json({ error: 'No se pudo enviar el correo.' }, { status: 500 });
      await markProposalSent(target.id);
      return NextResponse.json({ ok: true, proposals: await listProposals(100) });
    }
    return NextResponse.json({ error: 'acción inválida' }, { status: 400 });
  }

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
      name: String(b.name || '').slice(0, 120), logo_url: String(b.logo_url || '').slice(0, 400), banner_url: String(b.banner_url || '').slice(0, 500),
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
