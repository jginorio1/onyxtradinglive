import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { AD_SLOTS, getAdsConfig, saveAdsConfig, rateCard, slotByKey } from '@/lib/ads';
import { slotCap, dailyAvailability, listBookings, confirmPaid, cancelBooking, createBooking, sweepBookings } from '@/lib/adBooking';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PERM = 'planes';

// GET · reservas + cupos por ubicación + ajustes de espacios (para el panel).
export async function GET() {
  const { ok } = await requirePerm(PERM, 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const cfg = await getAdsConfig();
  const card = await rateCard();
  const slots = [];
  for (const s of card) slots.push({ key: s.key, es: s.es, en: s.en, size: s.size, page: s.page, price: s.price, cap: await slotCap(s.key, cfg) });

  const bookings = await listBookings({ limit: 300 });
  // Nombre del vendedor de cada reserva.
  const repIds = Array.from(new Set(bookings.map((b: any) => b.rep_id).filter(Boolean)));
  const repName: Record<string, string> = {};
  if (repIds.length) {
    const { data: reps } = await supabaseAdmin.from('sales_reps').select('id,display_name,code').in('id', repIds);
    for (const r of (reps || []) as any[]) repName[r.id] = r.display_name || r.code;
  }
  const rows = bookings.map((b: any) => ({ ...b, rep_name: b.rep_id ? (repName[b.rep_id] || '—') : null }));

  // Lista de vendedores (para atribuir una cotización enviada desde admin).
  const { data: repsAll } = await supabaseAdmin.from('sales_reps').select('id,display_name,code,status').eq('status', 'active').order('display_name', { ascending: true });
  const reps = (repsAll || []).map((r: any) => ({ id: r.id, name: r.display_name || r.code }));

  // Socios del directorio activos (para fijar uno por ubicación).
  const { data: partsAll } = await supabaseAdmin.from('ad_partners').select('id,name,geo,status').eq('status', 'active').order('name', { ascending: true });
  const partners = (partsAll || []).map((p: any) => ({ id: p.id, name: p.name, geo: p.geo || '' }));

  // Overrides globales de Ventas (para mostrar el valor heredado cuando Espacios los deja en blanco).
  const { salesSettings } = await import('@/lib/sales');
  const ss = await salesSettings();

  return NextResponse.json({
    ok: true,
    settings: {
      defaultCap: cfg.defaultCap, spaceCommissionPct: cfg.spaceCommissionPct,
      spaceOv1Pct: cfg.spaceOv1Pct, spaceOv2Pct: cfg.spaceOv2Pct,
      globalOv1: ss.override1_rate, globalOv2: ss.override2_rate,
      holdMinutes: cfg.holdMinutes, maturationDays: cfg.maturationDays,
      caps: cfg.caps || {}, partnerFill: cfg.partnerFill, partnerFillSlots: cfg.partnerFillSlots || {}, partnerSlotPin: cfg.partnerSlotPin || {},
    },
    slots, bookings: rows, reps, partners,
  });
}

// POST · acciones del admin.
export async function POST(req: Request) {
  const { ok } = await requirePerm(PERM, 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const b = await req.json().catch(() => ({} as any));
  const action = String(b.action || '');

  // Guardar cupos por ubicación + parámetros globales de espacios.
  if (action === 'save_settings') {
    const patch: any = {};
    if (b.caps && typeof b.caps === 'object') {
      const caps: Record<string, number> = {};
      for (const k of Object.keys(b.caps)) { const v = Math.max(0, Math.round(Number(b.caps[k]) || 0)); if (v > 0) caps[k] = v; }
      patch.caps = caps;
    }
    if (b.defaultCap !== undefined) patch.defaultCap = Math.max(1, Math.round(Number(b.defaultCap) || 4));
    if (b.spaceCommissionPct !== undefined) patch.spaceCommissionPct = Math.max(0, Math.min(100, Number(b.spaceCommissionPct) || 0));
    // Overrides de espacios: '' o null = heredar el global de Ventas; número = usar ese %.
    if (b.spaceOv1Pct !== undefined) patch.spaceOv1Pct = (b.spaceOv1Pct === null || b.spaceOv1Pct === '') ? null : Math.max(0, Math.min(100, Number(b.spaceOv1Pct) || 0));
    if (b.spaceOv2Pct !== undefined) patch.spaceOv2Pct = (b.spaceOv2Pct === null || b.spaceOv2Pct === '') ? null : Math.max(0, Math.min(100, Number(b.spaceOv2Pct) || 0));
    if (b.holdMinutes !== undefined) patch.holdMinutes = Math.max(5, Math.round(Number(b.holdMinutes) || 45));
    if (b.maturationDays !== undefined) patch.maturationDays = Math.max(0, Math.round(Number(b.maturationDays) || 14));
    if (b.partnerFill !== undefined) patch.partnerFill = b.partnerFill !== false;
    if (b.partnerFillSlots && typeof b.partnerFillSlots === 'object') {
      const pfs: Record<string, boolean> = {};
      for (const k of Object.keys(b.partnerFillSlots)) { const v = b.partnerFillSlots[k]; if (v === true || v === false) pfs[k] = v; }
      patch.partnerFillSlots = pfs;
    }
    if (b.partnerSlotPin && typeof b.partnerSlotPin === 'object') {
      const pin: Record<string, string> = {};
      for (const k of Object.keys(b.partnerSlotPin)) { const v = b.partnerSlotPin[k]; if (v && typeof v === 'string') pin[k] = v; }
      patch.partnerSlotPin = pin;
    }
    await saveAdsConfig(patch);
    return NextResponse.json({ ok: true });
  }

  // Calendario de disponibilidad de una ubicación.
  if (action === 'availability') {
    const from = /^\d{4}-\d{2}-\d{2}$/.test(b.from) ? b.from : new Date().toISOString().slice(0, 10);
    const days = Math.min(90, Math.max(14, Number(b.days) || 42));
    const calendar = await dailyAvailability(String(b.slot || ''), from, days);
    return NextResponse.json({ ok: true, calendar });
  }

  // Crear una reserva desde admin (sin vendedor, o asignada a uno).
  if (action === 'create') {
    const r = await createBooking({
      slotKey: String(b.slot || ''), startDate: String(b.start || ''), endDate: String(b.end || ''),
      advertiser: String(b.advertiser || ''), advertiserCompany: String(b.company || ''), advertiserEmail: String(b.email || ''),
      linkUrl: String(b.link || ''), note: String(b.note || ''), soldAmount: Number(b.price) || 0,
      repId: b.rep_id || null, source: 'admin',
    });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, id: r.id });
  }

  // Confirmar el pago → activa/programa y acredita la comisión del vendedor.
  if (action === 'confirm_paid') {
    const r = await confirmPaid(String(b.id || ''));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, phase: r.phase });
  }

  // Cancelar (libera cupo; si estaba pagada, revierte la comisión).
  if (action === 'cancel') {
    await cancelBooking(String(b.id || ''));
    return NextResponse.json({ ok: true });
  }

  // Generar / enviar la propuesta (cotización) desde admin. Si se pasa rep_id,
  // la propuesta sale a nombre de ese vendedor y con su correo; si no, sale a
  // nombre de Onyx con el remitente genérico.
  if (action === 'proposal_pdf' || action === 'proposal_email') {
    const slot = slotByKey(String(b.slot || ''));
    if (!slot) return NextResponse.json({ error: 'slot inválido' }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.start) || !/^\d{4}-\d{2}-\d{2}$/.test(b.end)) return NextResponse.json({ error: 'fechas inválidas' }, { status: 400 });
    const lang: 'es' | 'en' = b.lang === 'en' ? 'en' : 'es';
    let sellerName = 'Onyx Trading Live', sellerEmail = '', repWorkEmail: string | null = null;
    if (b.rep_id) {
      const { data: rep } = await supabaseAdmin.from('sales_reps').select('display_name,code,work_email,user_id').eq('id', b.rep_id).maybeSingle();
      if (rep) {
        sellerName = (rep as any).display_name || (rep as any).code || sellerName;
        repWorkEmail = (rep as any).work_email || null;
        sellerEmail = repWorkEmail || '';
        if (!sellerEmail && (rep as any).user_id) { const { data: p } = await supabaseAdmin.from('profiles').select('email').eq('id', (rep as any).user_id).maybeSingle(); sellerEmail = (p as any)?.email || ''; }
      }
    }
    const { adProposalPdf, adProposalEmail } = await import('@/lib/adSpaceProposal');
    const inp = {
      slotKey: slot.key,
      slotNameEs: slot.es, slotNameEn: slot.en, size: slot.size, pageEs: slot.page, pageEn: slot.page,
      startDate: String(b.start), endDate: String(b.end), price: Number(b.price) || slot.price,
      cap: await slotCap(slot.key), holdUntil: b.holdUntil || undefined,
      sellerName, sellerEmail, advertiser: String(b.advertiser || ''), advertiserCompany: String(b.company || ''),
      advertiserEmail: String(b.email || ''), linkUrl: String(b.link || ''),
    };
    const pdf = await adProposalPdf(inp, { lang });
    const base64 = Buffer.from(pdf).toString('base64');
    const filename = lang === 'en' ? 'onyx-ad-space-proposal.pdf' : 'propuesta-espacio-onyx.pdf';
    if (action === 'proposal_pdf') return NextResponse.json({ ok: true, pdf: base64, filename });

    const to = String(b.email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return NextResponse.json({ error: 'correo del anunciante inválido' }, { status: 400 });
    const { sendEmail, mailEnabled, fromWithAddr } = await import('@/lib/mail');
    if (!mailEnabled()) return NextResponse.json({ error: 'correo no configurado' }, { status: 400 });
    const em = adProposalEmail(inp, lang);
    const from = fromWithAddr(sellerName, repWorkEmail);
    const sent = await sendEmail(to, em.subject, em.body, { kind: 'ad_space_proposal', from, replyTo: sellerEmail || undefined, attachments: [{ filename, content: base64 }] });
    if (!sent) return NextResponse.json({ error: 'no se pudo enviar' }, { status: 500 });
    return NextResponse.json({ ok: true, sent: true });
  }

  // Barrido manual (expira terminadas + libera holds caducados).
  if (action === 'sweep') {
    const r = await sweepBookings();
    return NextResponse.json({ ok: true, ...r });
  }

  return NextResponse.json({ error: 'acción inválida' }, { status: 400 });
}
