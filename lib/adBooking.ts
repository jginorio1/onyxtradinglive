import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAdsConfig, slotByKey, type AdSlot, type AdsConfig } from '@/lib/ads';
import { reverseFromInvoice, salesSettings, beneficiaryChain, pctFor } from '@/lib/sales';

// ============================================================
// Onyx Ads · Reserva de espacios por CUPO FIJO + calendario
//
//  · Cada ubicación admite hasta N anunciantes rotando a la vez (cupo editable).
//  · El vendedor reserva un rango de fechas → "hold" temporal (draft con
//    hold_expires_at). Si no se paga a tiempo, el hold se libera solo y el cupo
//    vuelve a estar disponible; así una cotización sin pagar no bloquea el
//    calendario para siempre.
//  · Al confirmar el pago la campaña pasa a 'active' con starts_at/ends_at:
//      - fecha ya llegada → entra en la rotación en vivo al instante.
//      - fecha futura     → queda PROGRAMADA (pickAd solo la sirve dentro de la
//        ventana; no hace falta encenderla a mano).
//  · La comisión del vendedor (sobre el espacio vendido, NO por clic) se
//    acredita en sales_commissions con maduración y se revierte si hay reembolso.
//  · Un cron marca las vencidas como 'expired' y limpia los holds caducados.
// ============================================================

const DAY = 86400000;
const dstr = (d: Date) => d.toISOString().slice(0, 10);
const midnightMs = (iso: string) => new Date(iso.slice(0, 10) + 'T00:00:00.000Z').getTime();

export type BookingPhase = 'hold' | 'scheduled' | 'live' | 'ended' | 'expired';

// Cupo (máx anunciantes rotando a la vez) de un slot: valor propio o el default.
export async function slotCap(slotKey: string, cfg?: AdsConfig): Promise<number> {
  const c = cfg || (await getAdsConfig());
  const v = c.caps?.[slotKey];
  return typeof v === 'number' && v > 0 ? v : c.defaultCap;
}

// ¿Esta fila OCUPA cupo ahora? Activas/pendientes (pagadas) y holds (draft) aún
// vigentes cuentan; los holds caducados y las expiradas no.
function occupies(row: any, nowMs: number): boolean {
  if (row.status === 'active' || row.status === 'pending') return true;
  if (row.status === 'draft') {
    const h = row.hold_expires_at ? new Date(row.hold_expires_at).getTime() : 0;
    return h > nowMs;
  }
  return false;
}

async function bookingsFor(slotKey: string): Promise<any[]> {
  const { data } = await supabaseAdmin.from('ad_campaigns')
    .select('id,status,starts_at,ends_at,hold_expires_at,advertiser,advertiser_company,rep_id,sold_amount,paid_at')
    .eq('slot_key', slotKey).in('status', ['active', 'pending', 'draft']).limit(500);
  return data || [];
}

// ¿Cuántos cupos se usan en el DÍA t (ms, medianoche UTC) para ese slot?
function usedOnDay(rows: any[], t: number, nowMs: number): number {
  let n = 0;
  for (const r of rows) {
    if (!occupies(r, nowMs)) continue;
    const rs = r.starts_at ? midnightMs(r.starts_at) : 0;
    const re = r.ends_at ? midnightMs(r.ends_at) : Number.POSITIVE_INFINITY;
    if (t >= rs && t <= re) n++;
  }
  return n;
}

// Capacidad para un rango [start,end]: el punto más lleno del rango (peak).
// free = cupo − peak. Si free >= 1, cabe un anunciante más en TODO el rango.
export async function capacityFor(
  slotKey: string, startIso: string, endIso: string, excludeId?: string,
): Promise<{ cap: number; peak: number; free: number }> {
  const cap = await slotCap(slotKey);
  const rows = (await bookingsFor(slotKey)).filter((r) => r.id !== excludeId);
  const now = Date.now();
  const S = midnightMs(startIso), E = midnightMs(endIso);
  let peak = 0;
  for (let t = S; t <= E; t += DAY) {
    const n = usedOnDay(rows, t, now);
    if (n > peak) peak = n;
  }
  return { cap, peak, free: Math.max(0, cap - peak) };
}

// Disponibilidad DÍA A DÍA para pintar el calendario (N días desde fromIso).
export async function dailyAvailability(
  slotKey: string, fromIso: string, days = 42,
): Promise<{ date: string; used: number; cap: number; free: number; full: boolean; past: boolean }[]> {
  const cap = await slotCap(slotKey);
  const rows = await bookingsFor(slotKey);
  const now = Date.now();
  const todayMid = midnightMs(new Date().toISOString());
  const from = midnightMs(fromIso);
  const out = [];
  for (let i = 0; i < days; i++) {
    const t = from + i * DAY;
    const used = usedOnDay(rows, t, now);
    out.push({ date: dstr(new Date(t)), used, cap, free: Math.max(0, cap - used), full: used >= cap, past: t < todayMid });
  }
  return out;
}

// Fase legible de una reserva (para el panel).
export function phaseOf(row: any, nowMs = Date.now()): BookingPhase {
  if (row.status === 'expired') return 'expired';
  if (row.status === 'draft') {
    const h = row.hold_expires_at ? new Date(row.hold_expires_at).getTime() : 0;
    return h > nowMs ? 'hold' : 'expired';
  }
  const s = row.starts_at ? new Date(row.starts_at).getTime() : 0;
  const e = row.ends_at ? new Date(row.ends_at).getTime() : Number.POSITIVE_INFINITY;
  if (nowMs < s) return 'scheduled';
  if (nowMs > e) return 'ended';
  return 'live';
}

// Normaliza un rango [start,end] a medianoche/fin-de-día UTC en ISO.
function normRange(startDate: string, endDate: string): { startIso: string; endIso: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null;
  const s = new Date(startDate + 'T00:00:00.000Z');
  const e = new Date(endDate + 'T23:59:59.000Z');
  if (isNaN(+s) || isNaN(+e) || +e < +s) return null;
  return { startIso: s.toISOString(), endIso: e.toISOString() };
}

// Crea una reserva (hold). La usa el vendedor o el admin. Valida cupo en el rango
// completo. Devuelve el id para adjuntarlo a la propuesta/pago.
export async function createBooking(opts: {
  slotKey: string; startDate: string; endDate: string;
  advertiser: string; advertiserCompany?: string; advertiserEmail?: string;
  linkUrl?: string; note?: string; soldAmount: number;
  repId?: string | null; source?: 'seller' | 'admin' | 'self';
}): Promise<{ ok: boolean; id?: string; error?: string; holdUntil?: string }> {
  const slot = slotByKey(opts.slotKey);
  if (!slot) return { ok: false, error: 'Ubicación inválida.' };
  const range = normRange(opts.startDate, opts.endDate);
  if (!range) return { ok: false, error: 'Fechas inválidas.' };
  const advertiser = String(opts.advertiser || '').trim().slice(0, 120);
  if (!advertiser) return { ok: false, error: 'Falta el nombre del anunciante.' };

  const cfg = await getAdsConfig();
  const cap = await capacityFor(opts.slotKey, range.startIso, range.endIso);
  if (cap.free < 1) return { ok: false, error: `Sin cupo en esas fechas (cupo ${cap.cap}, ocupado ${cap.peak}). Elige otras fechas o sube el cupo.` };

  const holdUntil = new Date(Date.now() + Math.max(1, cfg.holdMinutes) * 60000).toISOString();
  const row: any = {
    slot_key: opts.slotKey, advertiser,
    advertiser_company: String(opts.advertiserCompany || '').slice(0, 160),
    advertiser_email: String(opts.advertiserEmail || '').slice(0, 160),
    contact: String(opts.advertiserEmail || '').slice(0, 160),
    link_url: String(opts.linkUrl || '').slice(0, 500),
    booking_note: String(opts.note || '').slice(0, 500),
    starts_at: range.startIso, ends_at: range.endIso,
    sold_amount: Math.max(0, Math.round(Number(opts.soldAmount) || 0)),
    commission_pct: cfg.spaceCommissionPct,
    rep_id: opts.repId || null, source: opts.source || 'seller',
    hold_expires_at: holdUntil, status: 'draft',
  };
  const { data, error } = await supabaseAdmin.from('ad_campaigns').insert(row).select('id').maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as any)?.id, holdUntil };
}

// Acredita la comisión del espacio vendido a TODA la cadena de 3 niveles
// (idempotente). El vendedor directo cobra el % de espacios (congelado al
// vender); su Lead (override1) y su Director (override2) cobran su override
// sobre la misma venta, exactamente como las suscripciones, reutilizando la
// cadena de beneficiarios de Ventas. Cae en sales_commissions → aparece en el
// extracto/saldos/pagos de cada uno, con maduración y clawback por reembolso.
async function creditSpaceCommission(booking: any, cfg: AdsConfig): Promise<void> {
  if (!booking?.rep_id) return;
  const base = Math.max(0, Number(booking.sold_amount) || 0);
  if (base <= 0) return;
  const s = await salesSettings();
  const { direct, up1, up2 } = await beneficiaryChain(booking.rep_id);
  const availableAt = new Date(Date.now() + Math.max(0, cfg.maturationDays) * DAY).toISOString();
  const invoiceId = `adspace:${booking.id}`;
  const rows: any[] = [];
  const add = (rep: any, pct: number, level: string) => {
    if (!rep || rep.status !== 'active') return;
    if (!(pct > 0)) return;
    rows.push({
      rep_id: rep.id, client_user_id: null, level, invoice_id: invoiceId,
      base_amount: base, pct, amount: Math.round(base * pct) / 100, currency: 'USD',
      status: 'pending', available_at: availableAt,
    });
  };
  // Directo: % de espacios (el congelado al vender, o el actual como respaldo).
  add(direct, Number(booking.commission_pct) || cfg.spaceCommissionPct || 0, 'ad_space');
  // Overrides: si Espacios tiene su propio % lo usa; si está vacío (null), hereda
  // el override global de Ventas. Así todo el reparto se controla desde un sitio.
  const ov1 = (cfg.spaceOv1Pct === null || cfg.spaceOv1Pct === undefined) ? pctFor(up1, 'override1', s) : Number(cfg.spaceOv1Pct);
  const ov2 = (cfg.spaceOv2Pct === null || cfg.spaceOv2Pct === undefined) ? pctFor(up2, 'override2', s) : Number(cfg.spaceOv2Pct);
  add(up1, ov1, 'ad_space_ov1');
  add(up2, ov2, 'ad_space_ov2');
  if (!rows.length) return;
  await supabaseAdmin.from('sales_commissions').upsert(rows, { onConflict: 'invoice_id,rep_id,level', ignoreDuplicates: true });
  // Avisos best-effort a cada beneficiario (nunca rompen el flujo).
  try {
    const { notifyRep } = await import('@/lib/salesNotify');
    for (const r of rows) await notifyRep(r.rep_id, 'commission', { amount: r.amount });
  } catch {}
}

// Confirma el pago de una reserva: la vuelve 'active' (programada si es a futuro)
// y acredita la comisión del vendedor. La activación/expiración real la maneja
// pickAd por ventana de fechas + el cron. Idempotente.
export async function confirmPaid(bookingId: string): Promise<{ ok: boolean; error?: string; phase?: BookingPhase }> {
  const { data: b } = await supabaseAdmin.from('ad_campaigns').select('*').eq('id', bookingId).maybeSingle();
  if (!b) return { ok: false, error: 'Reserva no encontrada.' };
  const cfg = await getAdsConfig();
  if ((b as any).status !== 'active') {
    // Re-valida cupo por si el hold caducó y alguien más ocupó el espacio.
    const cap = await capacityFor((b as any).slot_key, (b as any).starts_at, (b as any).ends_at, bookingId);
    if (cap.free < 1) return { ok: false, error: 'Ese espacio ya se llenó mientras esperaba el pago. Reprograma en otra fecha.' };
    await supabaseAdmin.from('ad_campaigns').update({
      status: 'active', paid_at: new Date().toISOString(), hold_expires_at: null,
    }).eq('id', bookingId);
  }
  try { await creditSpaceCommission(b, cfg); } catch {}
  return { ok: true, phase: phaseOf({ ...(b as any), status: 'active' }) };
}

// Cancela una reserva (hold o programada). Si estaba pagada, revierte la comisión.
export async function cancelBooking(bookingId: string): Promise<{ ok: boolean }> {
  const { data: b } = await supabaseAdmin.from('ad_campaigns').select('status').eq('id', bookingId).maybeSingle();
  await supabaseAdmin.from('ad_campaigns').update({ status: 'expired', hold_expires_at: null }).eq('id', bookingId);
  if ((b as any)?.status === 'active') { try { await reverseFromInvoice(`adspace:${bookingId}`); } catch {} }
  return { ok: true };
}

// Barrido periódico (cron): expira campañas terminadas y libera holds caducados.
export async function sweepBookings(): Promise<{ expired: number; released: number }> {
  const nowIso = new Date().toISOString();
  let expired = 0, released = 0;
  try {
    const { data: e } = await supabaseAdmin.from('ad_campaigns').update({ status: 'expired' })
      .eq('status', 'active').not('ends_at', 'is', null).lt('ends_at', nowIso).select('id');
    expired = (e || []).length;
  } catch {}
  try {
    const { data: r } = await supabaseAdmin.from('ad_campaigns').update({ status: 'expired', hold_expires_at: null })
      .eq('status', 'draft').not('hold_expires_at', 'is', null).lt('hold_expires_at', nowIso).select('id');
    released = (r || []).length;
  } catch {}
  return { expired, released };
}

// Lista de reservas para el panel (admin: todas; vendedor: solo las suyas).
export async function listBookings(opts: { repId?: string; limit?: number } = {}): Promise<any[]> {
  let q = supabaseAdmin.from('ad_campaigns')
    .select('id,slot_key,advertiser,advertiser_company,advertiser_email,starts_at,ends_at,status,hold_expires_at,sold_amount,commission_pct,rep_id,source,paid_at,created_at')
    .not('starts_at', 'is', null).order('created_at', { ascending: false }).limit(opts.limit || 200);
  if (opts.repId) q = q.eq('rep_id', opts.repId);
  const { data } = await q;
  const now = Date.now();
  return (data || []).map((r: any) => {
    const slot = slotByKey(r.slot_key);
    return { ...r, slot_name_es: slot?.es || r.slot_key, slot_name_en: slot?.en || r.slot_key, phase: phaseOf(r, now) };
  });
}
