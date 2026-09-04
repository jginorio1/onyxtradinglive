import { NextResponse } from 'next/server';
import { getAdmin, logAdmin } from '@/lib/admin';
import { saveSetting } from '@/lib/settings';
import {
  adminListProducts, setProductStatus, saveProduct, deleteProduct,
  listServiceRequests, setServiceStatus, listPayouts, markPayoutPaid,
  botLabSettings, botLabAdminStats,
} from '@/lib/botlab';
import { listCryptoPayments, confirmCryptoPayment, rejectCryptoPayment } from '@/lib/cryptoPay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function canManage(role: string | null, perms: any) {
  return role === 'owner' || perms?.modulos === 'manage';
}

// GET · todo lo que el panel necesita: productos, leads, cripto, payouts, ajustes.
export async function GET() {
  const { isAdmin, role, perms } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const [products, leads, crypto, payouts, settings, stats] = await Promise.all([
    adminListProducts(), listServiceRequests(), listCryptoPayments('pending'), listPayouts(), botLabSettings(), botLabAdminStats(),
  ]);
  return NextResponse.json({ products, leads, crypto, payouts, settings, stats, canManage: canManage(role, perms) });
}

// POST · acciones del dueño/gestor.
export async function POST(req: Request) {
  const { user, isAdmin, role, perms } = await getAdmin();
  if (!isAdmin || !canManage(role, perms)) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const a = b.action;

  if (a === 'product_status') { await setProductStatus(String(b.id), { status: b.status, verified: b.verified, is_official: b.is_official, position: b.position }); await logAdmin(user.email || '', 'botlab_product_status', String(b.id), { status: b.status }); return NextResponse.json({ ok: true }); }
  if (a === 'product_save') { const r = await saveProduct('', b.product || {}, true); return NextResponse.json({ ok: true, id: r?.id }); }
  if (a === 'product_delete') { await deleteProduct('', String(b.id), true); return NextResponse.json({ ok: true }); }
  if (a === 'lead_status') { await setServiceStatus(String(b.id), String(b.status)); return NextResponse.json({ ok: true }); }
  if (a === 'crypto_confirm') { const r = await confirmCryptoPayment(String(b.id)); await logAdmin(user.email || '', 'botlab_crypto_confirm', String(b.id), {}); return NextResponse.json(r); }
  if (a === 'crypto_reject') { await rejectCryptoPayment(String(b.id)); return NextResponse.json({ ok: true }); }
  if (a === 'payout_paid') { await markPayoutPaid(String(b.id)); await logAdmin(user.email || '', 'botlab_payout_paid', String(b.id), {}); return NextResponse.json({ ok: true }); }
  if (a === 'settings') {
    const cur = await botLabSettings();
    const next = {
      fee_pct: Math.max(0, Math.min(50, Number(b.fee_pct ?? cur.fee_pct))),
      usdt_address: String(b.usdt_address ?? cur.usdt_address ?? '').slice(0, 120),
      usdt_network: String(b.usdt_network ?? cur.usdt_network ?? 'trc20').slice(0, 10),
      service_automate_from: Math.max(0, Number(b.service_automate_from ?? cur.service_automate_from)),
      service_install_price: Math.max(0, Number(b.service_install_price ?? cur.service_install_price)),
      service_elite_from: Math.max(0, Number(b.service_elite_from ?? cur.service_elite_from)),
    };
    await saveSetting('bot_lab', next);
    return NextResponse.json({ ok: true, settings: next });
  }
  return NextResponse.json({ error: 'acción no válida' }, { status: 400 });
}
