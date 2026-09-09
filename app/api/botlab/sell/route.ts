import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { myProducts, saveProduct, deleteProduct, sellerEarnings, sellerConnectStatus, sellerOnboardingLink, listPayouts, createPayout, runBotPayout, botLabSettings, validateForSale, myReferralEarnings } from '@/lib/botlab';
import { botScore } from '@/lib/botScore';

// Extensiones permitidas para el archivo del robot (entrega).
const OK_EXT = ['ex4', 'ex5', 'mq4', 'mq5', 'set', 'zip', 'algo'];
const MAX_FILE = 20 * 1024 * 1024; // 20 MB

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · panel del creador: sus robots, ganancias, estado de cobro y payouts.
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const [products, earnings, connect, payouts, referral] = await Promise.all([
    myProducts(user.id), sellerEarnings(user.id), sellerConnectStatus(user.id), listPayouts(user.id), myReferralEarnings(user.id),
  ]);
  return NextResponse.json({ me: user.id, products, earnings, connect, payouts, referral });
}

// POST · acciones del creador: guardar/borrar robot, conectar cobro, pedir retiro.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  if (b.action === 'connect') {
    try { const url = await sellerOnboardingLink(user.id, user.email || undefined); return NextResponse.json({ url }); }
    catch (e: any) { return NextResponse.json({ error: e?.message || 'No se pudo iniciar el cobro.' }, { status: 500 }); }
  }
  if (b.action === 'my_builds') {
    // Recetas del constructor del vendedor, para ligar un producto (Modelo A).
    const { data } = await supabaseAdmin.from('bots_built').select('id,name,platform,magic,spec').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(100);
    return NextResponse.json({ builds: data || [] });
  }
  if (b.action === 'check') {
    // Chequeo de elegibilidad ANTES de publicar: le dice al vendedor qué le falta,
    // para que no haya rechazos sorpresa. Mide con las operaciones reales del robot.
    const p = b.product || {};
    const cfg = await botLabSettings();
    const s = await botScore({ sellerId: user.id, accountId: p.bot_account, magic: p.bot_magic, text: [p.name, p.tagline, p.description].filter(Boolean).join(' ') });
    const need = Math.max(0, Math.round(Number(cfg.val_min_trades) || 30));
    const needDays = Math.max(0, Math.round(Number(cfg.val_min_days) || 14));
    const checks = [
      { key: 'trades', ok: s.trades >= need, label: `Operaciones reales (${s.trades}/${need})`, en: `Real trades (${s.trades}/${need})` },
      { key: 'days', ok: s.days >= needDays, label: `Días operando (${s.days}/${needDays})`, en: `Days trading (${s.days}/${needDays})` },
      { key: 'sl', ok: !!p.spec_sl && !s.slRisk, label: 'Usa Stop Loss', en: 'Uses Stop Loss' },
      { key: 'martingale', ok: !s.martingale, label: 'Sin martingala', en: 'No martingale' },
      { key: 'hft', ok: !s.hft, label: 'Sin alta frecuencia', en: 'No high-frequency' },
    ];
    const chk = validateForSale(cfg, s, { sl: p.spec_sl });
    return NextResponse.json({ ok: chk.ok, hasData: s.hasData, checks, reasons: chk.reasons, score: s.score, trades: s.trades, days: s.days });
  }
  if (b.action === 'save') {
    // Validación con OPERACIONES REALES contra las reglas editables (Admin → Validación):
    // mínimos, martingala, alta frecuencia, drawdown, y Stop Loss obligatorio.
    const p = b.product || {};
    // Modelo A: si liga una receta del constructor, verifica que sea SUYA y toma su magic.
    if (p.source === 'build') {
      if (!p.build_id) return NextResponse.json({ error: 'Elige cuál de tus robots del constructor quieres vender.' }, { status: 400 });
      const { data: bld } = await supabaseAdmin.from('bots_built').select('id,magic').eq('id', p.build_id).eq('user_id', user.id).maybeSingle();
      if (!bld) return NextResponse.json({ error: 'Esa receta del constructor no es tuya o ya no existe.' }, { status: 400 });
      if (!p.bot_magic && (bld as any).magic) p.bot_magic = (bld as any).magic;   // el magic de la receta liga la licencia
    }
    const text = [p.name, p.tagline, p.description].filter(Boolean).join(' \n ');
    const cfg = await botLabSettings();
    const s = await botScore({ sellerId: user.id, accountId: p.bot_account, magic: p.bot_magic, text });
    const chk = validateForSale(cfg, s, { sl: p.spec_sl });
    if (!chk.ok) return NextResponse.json({ error: chk.reasons.join(' ') }, { status: 400 });
    // Guardamos también lo detectado en `perf` para pintar la ficha técnica del comprador.
    const detected = { avgHoldMin: s.avgHoldMin, tradesPerWeek: s.tradesPerWeek, martingale: s.martingale, hft: s.hft, hasSL: !s.slRisk };
    const r = await saveProduct(user.id, { ...p, __detected: undefined }, false);
    // Auto-publicación: como YA pasó todas las reglas (chk.ok), el robot sale directo al
    // marketplace sin cola de aprobación. El admin puede despublicarlo o destacarlo después.
    if (r?.id) { try { await supabaseAdmin.from('bot_products').update({ status: 'active', perf: { ...(s.hasData ? { score: s.score, winrate: s.winRate, dd: s.ddPct, pf: s.pf, trades: s.trades, days: s.days, live: s.live } : {}), ...detected } }).eq('id', r.id); } catch {} }
    return NextResponse.json({ ok: true, id: r?.id, status: 'active' });
  }
  if (b.action === 'upload_file') {
    // Sube el archivo del robot al bucket PRIVADO 'bot-files'. Llega como data URL base64.
    const name = String(b.name || 'robot').replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (!OK_EXT.includes(ext)) return NextResponse.json({ error: `Tipo no permitido. Usa: ${OK_EXT.join(', ')}.` }, { status: 400 });
    const m = /^data:[^;]*;base64,(.+)$/s.exec(String(b.data || ''));
    if (!m) return NextResponse.json({ error: 'formato inválido' }, { status: 400 });
    const buf = Buffer.from(m[1], 'base64');
    if (buf.byteLength > MAX_FILE) return NextResponse.json({ error: 'archivo demasiado grande (máx 20 MB)' }, { status: 400 });
    const path = `${user.id}/${Date.now()}-${name}`;
    const up = await supabaseAdmin.storage.from('bot-files').upload(path, buf, { upsert: false });
    if (up.error) return NextResponse.json({ error: up.error.message, hint: 'Crea el bucket PRIVADO "bot-files" en Supabase → Storage.' }, { status: 500 });
    return NextResponse.json({ ok: true, file_path: path, file_name: name, file_size: buf.byteLength });
  }
  if (b.action === 'delete') { await deleteProduct(user.id, String(b.id || ''), false); return NextResponse.json({ ok: true }); }
  if (b.action === 'payout') {
    const e = await sellerEarnings(user.id);
    if (e.availableCents < 1000) return NextResponse.json({ error: 'Necesitas al menos $10 disponibles para retirar.' }, { status: 400 });
    const method = b.method === 'stripe' ? 'stripe' : 'usdt';
    if (method === 'stripe') {
      // Stripe Express: requiere el cobro conectado del creador.
      const c = await sellerConnectStatus(user.id);
      if (!c.connected || !c.chargesEnabled) return NextResponse.json({ error: 'Conecta tu cuenta de cobro (Stripe Express) antes de retirar por banco.' }, { status: 400 });
    } else if (!b.destination) {
      return NextResponse.json({ error: 'Pon tu dirección USDT.' }, { status: 400 });
    }
    const p = await createPayout({ sellerId: user.id, amountCents: e.availableCents, method, destination: method === 'usdt' ? (b.destination || null) : 'stripe_express', note: 'Solicitado por el creador' });
    // Stripe: la transferencia se ejecuta al instante. USDT: queda pendiente para que el admin la envíe.
    if (method === 'stripe' && (p as any)?.id) {
      const r = await runBotPayout(String((p as any).id));
      if (!r.ok) return NextResponse.json({ error: r.error || 'No se pudo enviar la transferencia. Se dejó como pendiente.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'acción no válida' }, { status: 400 });
}
