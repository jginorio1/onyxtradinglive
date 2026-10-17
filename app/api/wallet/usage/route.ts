import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { usageSummary } from '@/lib/usage';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · resumen de pago por uso para la pestaña Suscripción del cliente:
// saldo, gasto del mes por categoría, tarifas, incluido gratis y upsell.
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });
    const summary = await usageSummary(user.id);
    return NextResponse.json({ ok: true, ...summary });
  } catch (e: any) {
    await logError('wallet_usage', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
