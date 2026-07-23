import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Endpoint ligero para el asistente de instalación.
// Lo llama cada pocos segundos mientras espera la primera señal del EA,
// así que devuelve lo justo: si hay cuenta reportando y sus datos.
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const { data: accounts } = await supabaseAdmin
      .from('trading_accounts')
      .select('id,login,broker,server,platform,last_sync_at,ea_version')
      .eq('user_id', user.id)
      .order('last_sync_at', { ascending: false, nullsFirst: false })
      .limit(5);

    const synced = (accounts || []).filter((a: any) => a.last_sync_at);
    const latest = synced[0] || null;

    // Cuántas operaciones se importaron: es la prueba de que funcionó
    let trades = 0;
    if (latest) {
      const { count } = await supabaseAdmin
        .from('trades').select('*', { count: 'exact', head: true }).eq('account_id', latest.id);
      trades = count || 0;
    }

    // ¿Sigue viva la conexión ahora mismo?
    const now = Date.now();
    const live = latest ? (now - new Date(latest.last_sync_at).getTime()) < 120000 : false;

    // Lista de todas las cuentas con su estado (para la vista multi-cuenta)
    const list = (accounts || []).map((a: any) => ({
      login: a.login,
      broker: a.broker || '',
      platform: a.platform || '',
      lastSyncAt: a.last_sync_at,
      live: a.last_sync_at ? (now - new Date(a.last_sync_at).getTime()) < 120000 : false,
    }));

    // Claves creadas que aún no tienen cuenta reportando: "en espera".
    // Así el trader ve la cuenta nueva antes de que su EA envíe la primera señal.
    const { data: keyRows } = await supabaseAdmin
      .from('api_keys')
      .select('label,broker,account_login,revoked')
      .eq('user_id', user.id)
      .eq('revoked', false);
    const allLogins = new Set((accounts || []).map((a: any) => String(a.login)));
    const pending = (keyRows || [])
      .filter((k: any) => {
        const login = String(k.account_login || '').trim();
        return login === '' || !allLogins.has(login);
      })
      .map((k: any) => ({ label: k.label || '', broker: k.broker || '' }));

    return NextResponse.json({
      connected: !!latest,
      live,
      totalAccounts: (accounts || []).length,
      syncedAccounts: synced.length,
      accounts: list,
      pending,
      account: latest ? {
        login: latest.login,
        broker: latest.broker || '',
        server: latest.server || '',
        platform: latest.platform || '',
        eaVersion: latest.ea_version || '',
        lastSyncAt: latest.last_sync_at,
      } : null,
      trades,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
