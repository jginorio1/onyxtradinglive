import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { AD_SLOTS, getAdsConfig, saveAdsConfig, rateCard } from '@/lib/ads';
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

  return NextResponse.json({
    ok: true,
    settings: { defaultCap: cfg.defaultCap, spaceCommissionPct: cfg.spaceCommissionPct, holdMinutes: cfg.holdMinutes, maturationDays: cfg.maturationDays, caps: cfg.caps || {} },
    slots, bookings: rows,
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
    if (b.holdMinutes !== undefined) patch.holdMinutes = Math.max(5, Math.round(Number(b.holdMinutes) || 45));
    if (b.maturationDays !== undefined) patch.maturationDays = Math.max(0, Math.round(Number(b.maturationDays) || 14));
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

  // Barrido manual (expira terminadas + libera holds caducados).
  if (action === 'sweep') {
    const r = await sweepBookings();
    return NextResponse.json({ ok: true, ...r });
  }

  return NextResponse.json({ error: 'acción inválida' }, { status: 400 });
}
