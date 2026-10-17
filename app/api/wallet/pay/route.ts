import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { debit } from '@/lib/wallet';
import { pickLang } from '@/lib/i18n';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · pagar algo dentro de Onyx USANDO EL SALDO del monedero.
// purpose soportado ahora: 'remote_support'. El monto lo fija el servidor desde
// la config (no se confía en el cliente). Débito idempotente + entrega.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Inicia sesión.', code: 'auth' }, { status: 401 });

    const b = await req.json().catch(() => ({} as any));
    const lang = pickLang(b.lang); const en = lang === 'en';
    const purpose = String(b.purpose || '');

    if (purpose === 'remote_support') {
      const { getRemoteConfig, fulfillRemoteSession } = await import('@/lib/remoteSupport');
      const cfg = await getRemoteConfig();
      if (!cfg.on) return NextResponse.json({ error: en ? 'Remote support is off.' : 'El soporte remoto no está disponible.', code: 'off' }, { status: 400 });
      const cents = Math.max(0, Math.round(Number(cfg.price) || 0) * 100);
      if (cents <= 0) return NextResponse.json({ error: en ? 'No price set.' : 'Sin precio configurado.', code: 'noprice' }, { status: 400 });
      const orderId = `wallet_rs_${user.id}_${Date.now()}`;
      const d = await debit({ userId: user.id, amountCents: cents, source: 'remote_support', extRef: orderId, note: en ? 'Remote support' : 'Soporte remoto' });
      if (!d.ok) {
        if (d.reason === 'insufficient') return NextResponse.json({ error: en ? 'Not enough balance. Top up first.' : 'Saldo insuficiente. Recarga primero.', code: 'insufficient', balanceCents: d.balance || 0 }, { status: 400 });
        return NextResponse.json({ error: en ? 'Could not charge balance.' : 'No se pudo cobrar del saldo.', code: 'debit' }, { status: 400 });
      }
      try { await fulfillRemoteSession({ sessionId: orderId, email: user.email || '', userId: user.id, lang, amount: Math.round(cents / 100) }); } catch (e) { await logError('wallet_pay_rs', e); }
      return NextResponse.json({ ok: true, paid: cents });
    }

    return NextResponse.json({ error: 'purpose no soportado', code: 'bad_purpose' }, { status: 400 });
  } catch (e: any) {
    await logError('wallet_pay', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
