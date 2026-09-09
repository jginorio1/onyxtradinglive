import { NextResponse } from 'next/server';
import { getAdmin, logAdmin } from '@/lib/admin';
import { saveSetting } from '@/lib/settings';
import {
  adminListProducts, setProductStatus, saveProduct, deleteProduct,
  listServiceRequests, setServiceStatus, listPayouts, markPayoutPaid,
  botLabSettings, botLabAdminStats,
  listLeadMessages, addLeadNote, sendLeadEmail, botLabAudienceCounts, botLabBroadcast,
  listSellersWithFee, setSellerFeePct,
} from '@/lib/botlab';
import { listCryptoPayments, confirmCryptoPayment, rejectCryptoPayment } from '@/lib/cryptoPay';
import { officialMentor, makeOfficialAcademy } from '@/lib/academy';
import { botScore } from '@/lib/botScore';
import { mailDomainStatus } from '@/lib/mail';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function canManage(role: string | null, perms: any) {
  return role === 'owner' || perms?.modulos === 'manage';
}

// GET · todo lo que el panel necesita: productos, leads, cripto, payouts, ajustes.
export async function GET() {
  const { user, isAdmin, role, perms } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const [products, leads, crypto, payouts, settings, stats, audience, mail, official] = await Promise.all([
    adminListProducts(), listServiceRequests(), listCryptoPayments('pending'), listPayouts(), botLabSettings(), botLabAdminStats(),
    botLabAudienceCounts(), mailDomainStatus(), officialMentor(),
  ]);
  const academy = official ? { exists: true, code: official.code, academy_name: official.academy_name, mine: official.user_id === user?.id } : { exists: false };
  // Reseñas del Marketplace (compartidas con el landing «Crea tu bot»): viven en landing_stats.reviews.
  let reviews: any[] = [];
  try { const { data: ls } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'landing_stats').maybeSingle(); if (Array.isArray((ls as any)?.value?.reviews)) reviews = (ls as any).value.reviews; } catch {}
  // Score de verificación con operaciones REALES (solo para los que hay que revisar/mostrar).
  const scored = await Promise.all((products as any[]).map(async (p) => {
    if (p.status !== 'pending' && p.status !== 'active') return p;
    const text = [p.name, p.tagline, p.description].filter(Boolean).join(' \n ');
    const _score = await botScore({ sellerId: p.seller_id, accountId: p.bot_account, magic: p.bot_magic, text });
    return { ...p, _score };
  }));
  return NextResponse.json({ products: scored, leads, crypto, payouts, settings, stats, audience, mail, reviews, academy, canManage: canManage(role, perms) });
}

// POST · acciones del dueño/gestor.
export async function POST(req: Request) {
  const { user, isAdmin, role, perms } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const a = b.action;

  // Lectura del hilo de un lead: cualquier admin puede verla.
  if (a === 'lead_thread') {
    const messages = await listLeadMessages(String(b.id || ''));
    return NextResponse.json({ messages });
  }

  // Lista de traders con su comisión (propia o global): cualquier admin puede verla.
  if (a === 'seller_fees') {
    const sellers = await listSellersWithFee();
    return NextResponse.json({ sellers });
  }

  // De aquí en adelante hacen falta permisos de gestión.
  if (!canManage(role, perms)) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  // Fijar (o limpiar, con pct null/'') la comisión propia de un trader.
  if (a === 'set_seller_fee') {
    const raw = b.pct;
    const pct = raw === null || raw === '' || raw === undefined ? null : Number(raw);
    const val = await setSellerFeePct(String(b.sellerId || ''), pct);
    await logAdmin(user.email || '', 'botlab_seller_fee', String(b.sellerId || ''), { pct: val });
    return NextResponse.json({ ok: true, fee_pct: val });
  }

  if (a === 'lead_email') {
    try { const r = await sendLeadEmail({ leadId: String(b.id || ''), subject: b.subject, body: b.body, adminEmail: user.email || undefined }); await logAdmin(user.email || '', 'botlab_lead_email', String(b.id || ''), {}); return NextResponse.json(r); }
    catch (e: any) { return NextResponse.json({ error: e?.message || 'No se pudo enviar.' }, { status: 400 }); }
  }
  if (a === 'lead_note') {
    try { const r = await addLeadNote(String(b.id || ''), String(b.body || ''), user.email || undefined); return NextResponse.json(r); }
    catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 400 }); }
  }
  if (a === 'broadcast') {
    try { const r = await botLabBroadcast({ segment: b.segment, subject: b.subject, body: b.body, dryRun: !!b.dryRun }); await logAdmin(user.email || '', 'botlab_broadcast', b.segment || '', { count: r.count, sent: r.sent }); return NextResponse.json(r); }
    catch (e: any) { return NextResponse.json({ error: e?.message || 'No se pudo enviar.' }, { status: 400 }); }
  }

  // Crea/abre la academia OFICIAL "Onyx Bot Lab" a nombre del admin. Solo owner.
  if (a === 'academy_official') {
    if (role !== 'owner') return NextResponse.json({ error: 'Solo el dueño puede crear la academia oficial.' }, { status: 403 });
    const m = await makeOfficialAcademy(user.id);
    await logAdmin(user.email || '', 'botlab_academy_official', m?.code || '', {});
    return NextResponse.json({ ok: true, code: m?.code, academy_name: m?.academy_name, mine: m?.user_id === user.id });
  }

  if (a === 'product_status') {
    await setProductStatus(String(b.id), { status: b.status, verified: b.verified, is_official: b.is_official, position: b.position, review_note: b.review_note });
    // Al aprobar, congelamos el track record real en el producto (para mostrarlo en el marketplace).
    if (b.status === 'active') {
      const { data: p } = await supabaseAdmin.from('bot_products').select('id,seller_id,bot_account,bot_magic,name,tagline,description').eq('id', b.id).maybeSingle();
      if (p) {
        const s = await botScore({ sellerId: (p as any).seller_id, accountId: (p as any).bot_account, magic: (p as any).bot_magic });
        if (s.hasData) {
          await supabaseAdmin.from('bot_products').update({
            verify_score: s.score, verify_at: new Date().toISOString(),
            perf: { score: s.score, winrate: s.winRate, dd: s.ddPct, pf: s.pf, trades: s.trades, days: s.days, live: s.live },
          }).eq('id', b.id);
        }
      }
    }
    await logAdmin(user.email || '', 'botlab_product_status', String(b.id), { status: b.status });
    return NextResponse.json({ ok: true });
  }
  if (a === 'reviews_save') {
    const arr = Array.isArray(b.reviews) ? b.reviews.slice(0, 200).map((r: any) => ({
      name: String(r?.name || '').slice(0, 60), text: String(r?.text || '').slice(0, 500),
      stars: Math.max(1, Math.min(5, Math.round(Number(r?.stars) || 5))),
      country: String(r?.country || '').slice(0, 4), date: String(r?.date || '').slice(0, 40),
      result: String(r?.result || '').slice(0, 40), lang: r?.lang === 'en' ? 'en' : 'es',
    })).filter((r: any) => r.text) : [];
    const { data: ls } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'landing_stats').maybeSingle();
    const cur = (ls as any)?.value && typeof (ls as any).value === 'object' ? (ls as any).value : {};
    await saveSetting('landing_stats', { ...cur, reviews: arr });
    await logAdmin(user.email || '', 'botlab_reviews_save', '', { count: arr.length });
    return NextResponse.json({ ok: true, reviews: arr });
  }
  if (a === 'product_save') { const r = await saveProduct('', b.product || {}, true); return NextResponse.json({ ok: true, id: r?.id }); }
  if (a === 'product_delete') { await deleteProduct('', String(b.id), true); return NextResponse.json({ ok: true }); }
  if (a === 'lead_status') { await setServiceStatus(String(b.id), String(b.status)); return NextResponse.json({ ok: true }); }
  if (a === 'crypto_confirm') { const r = await confirmCryptoPayment(String(b.id)); await logAdmin(user.email || '', 'botlab_crypto_confirm', String(b.id), {}); return NextResponse.json(r); }
  if (a === 'crypto_reject') { await rejectCryptoPayment(String(b.id)); return NextResponse.json({ ok: true }); }
  if (a === 'payout_paid') { await markPayoutPaid(String(b.id)); await logAdmin(user.email || '', 'botlab_payout_paid', String(b.id), {}); return NextResponse.json({ ok: true }); }
  if (a === 'val_ai') {
    // Asistente: dado el objetivo del dueño, sugiere umbrales de validación + explica.
    const goal = String(b.goal || '').slice(0, 500);
    const cur = await botLabSettings();
    const key = process.env.ANTHROPIC_API_KEY;
    const fallback = { params: { val_min_trades: 40, val_min_days: 21, val_min_score: 70, val_min_pf: 120, val_max_dd: 20 }, note: 'Sugerencia base para calidad sobre cantidad: sube la muestra y el score, baja el drawdown. Ajusta a tu gusto.' };
    if (!key) return NextResponse.json(fallback);
    try {
      const system = 'Eres asesor de un marketplace de robots de trading (Onyx Bot Lab). Sugiere umbrales de validación razonables según el objetivo del dueño. NUNCA prometas ganancias ni predigas el mercado. Responde SOLO JSON: {"params":{"val_min_trades":int,"val_min_days":int,"val_min_score":0-100,"val_min_pf":int(x100, ej 120),"val_max_dd":int %},"note":"explicación breve en español, 1-2 frases"}.';
      const user = `Config actual: ${JSON.stringify({ val_min_trades: cur.val_min_trades, val_min_days: cur.val_min_days, val_min_score: cur.val_min_score, val_min_pf: cur.val_min_pf, val_max_dd: cur.val_max_dd })}. Objetivo del dueño: "${goal || 'un marketplace equilibrado'}".`;
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: process.env.ONYX_AI_MODEL || 'claude-haiku-4-5-20251001', max_tokens: 400, system, messages: [{ role: 'user', content: user }] }) });
      if (!r.ok) return NextResponse.json(fallback);
      const d = await r.json();
      const txt = String(d?.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(txt);
      return NextResponse.json({ params: parsed.params || fallback.params, note: parsed.note || fallback.note });
    } catch { return NextResponse.json(fallback); }
  }
  if (a === 'settings') {
    const cur = await botLabSettings();
    const next = {
      fee_pct: Math.max(0, Math.min(50, Number(b.fee_pct ?? cur.fee_pct))),
      usdt_address: String(b.usdt_address ?? cur.usdt_address ?? '').slice(0, 120),
      usdt_network: String(b.usdt_network ?? cur.usdt_network ?? 'trc20').slice(0, 10),
      usdt_erc20: String(b.usdt_erc20 ?? cur.usdt_erc20 ?? '').trim().slice(0, 60),
      usdt_trc20: String(b.usdt_trc20 ?? cur.usdt_trc20 ?? '').trim().slice(0, 60),
      service_automate_from: Math.max(0, Number(b.service_automate_from ?? cur.service_automate_from)),
      service_install_price: Math.max(0, Number(b.service_install_price ?? cur.service_install_price)),
      service_elite_from: Math.max(0, Number(b.service_elite_from ?? cur.service_elite_from)),
      notify_email: String(b.notify_email ?? cur.notify_email ?? '').slice(0, 120),
      telegram_chat: String(b.telegram_chat ?? cur.telegram_chat ?? '').slice(0, 40),
      stats_on: b.stats_on != null ? !!b.stats_on : (cur.stats_on !== false),
      stat_robots_base: Math.max(0, Math.round(Number(b.stat_robots_base ?? cur.stat_robots_base ?? 0))),
      stat_verified_base: Math.max(0, Math.round(Number(b.stat_verified_base ?? cur.stat_verified_base ?? 0))),
      stat_score_avg: Math.max(0, Math.min(100, Math.round(Number(b.stat_score_avg ?? cur.stat_score_avg ?? 87)))),
      stat_buyers_week: Math.max(0, Math.round(Number(b.stat_buyers_week ?? cur.stat_buyers_week ?? 0))),
      stat_price_from: Math.max(0, Math.round(Number(b.stat_price_from ?? cur.stat_price_from ?? 19))),
      pay_trc20: b.pay_trc20 != null ? !!b.pay_trc20 : (cur.pay_trc20 !== false),
      pay_erc20: b.pay_erc20 != null ? !!b.pay_erc20 : (cur.pay_erc20 !== false),
      pay_card: b.pay_card != null ? !!b.pay_card : (cur.pay_card === true),
      robots_monthly: b.robots_monthly != null ? !!b.robots_monthly : (cur.robots_monthly === true),
      val_min_trades: Math.max(0, Math.round(Number(b.val_min_trades ?? cur.val_min_trades ?? 30))),
      val_min_days: Math.max(0, Math.round(Number(b.val_min_days ?? cur.val_min_days ?? 14))),
      val_min_score: Math.max(0, Math.min(100, Math.round(Number(b.val_min_score ?? cur.val_min_score ?? 60)))),
      val_min_pf: Math.max(0, Math.round(Number(b.val_min_pf ?? cur.val_min_pf ?? 110))),
      val_max_dd: Math.max(0, Math.min(100, Math.round(Number(b.val_max_dd ?? cur.val_max_dd ?? 30)))),
      val_require_sl: b.val_require_sl != null ? !!b.val_require_sl : (cur.val_require_sl !== false),
      val_reject_martingale: b.val_reject_martingale != null ? !!b.val_reject_martingale : (cur.val_reject_martingale !== false),
      val_reject_hft: b.val_reject_hft != null ? !!b.val_reject_hft : (cur.val_reject_hft !== false),
      val_hft_min_hold: Math.max(0, Math.round(Number(b.val_hft_min_hold ?? cur.val_hft_min_hold ?? 5))),
      val_hft_max_day: Math.max(1, Math.round(Number(b.val_hft_max_day ?? cur.val_hft_max_day ?? 20))),
      lic_max_accounts: Math.max(0, Math.round(Number(b.lic_max_accounts ?? cur.lic_max_accounts ?? 3))),
      affiliate_max: Math.max(0, Math.min(90, Math.round(Number(b.affiliate_max ?? cur.affiliate_max ?? 80)))),
      // Automatización de pagos a creadores/referidos (frenos incluidos).
      payout_hold_days: Math.max(0, Math.min(90, Math.round(Number(b.payout_hold_days ?? cur.payout_hold_days ?? 14)))),
      payout_min_cents: Math.max(0, Math.round(Number(b.payout_min_cents ?? cur.payout_min_cents ?? 1000))),
      payout_auto: b.payout_auto != null ? !!b.payout_auto : (cur.payout_auto === true),
      payout_review: b.payout_review != null ? !!b.payout_review : (cur.payout_review === true),
    };
    // Nunca dejar todos los métodos apagados: si no queda ninguno, re-enciende TRON.
    if (!next.pay_trc20 && !next.pay_erc20 && !next.pay_card) next.pay_trc20 = true;
    await saveSetting('bot_lab', next);
    return NextResponse.json({ ok: true, settings: next });
  }
  return NextResponse.json({ error: 'acción no válida' }, { status: 400 });
}
