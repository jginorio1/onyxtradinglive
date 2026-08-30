import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Candado de activación de los robots del constructor (cuentas REALES).
// El EA generado hace POST aquí con su clave Onyx + cuenta + huella (creador+build).
// Devuelve { allowed } según: clave válida y no revocada, que no sea clave de Copy,
// y que la cuenta coincida con la clave (una clave = una cuenta). Los bots en DEMO
// no llaman aquí (se permiten libres para probar). La huella se registra para poder
// rastrear archivos revendidos/filtrados.
export async function POST(req: Request) {
  const deny = (reason: string) => NextResponse.json({ allowed: false, reason });
  try {
    const b = await req.json().catch(() => ({}));
    const key = String(b?.key || '').trim();
    const account = Number(String(b?.account || '').replace(/\D/g, '')) || 0;
    const magic = Number(b?.magic) || 0;
    const build = String(b?.build || '').slice(0, 64);
    const creator = String(b?.creator || '').slice(0, 64);
    if (!key || key.length < 8) return deny('no_key');

    const { data: k } = await supabaseAdmin
      .from('api_keys')
      .select('id,user_id,revoked,account_login,kind')
      .eq('key', key)
      .maybeSingle();

    if (!k || k.revoked) return deny('invalid_key');
    if (k.kind === 'copy') return deny('copy_key');           // clave de Copy, no de robots
    // Una clave pertenece a UNA cuenta: si ya está atada a otra, no autoriza.
    if (k.account_login != null && account && Number(k.account_login) !== account) return deny('account_mismatch');
    // Si la clave aún no tenía cuenta, la atamos a esta (igual que el sync).
    if (k.account_login == null && account) {
      await supabaseAdmin.from('api_keys').update({ account_login: account }).eq('id', k.id);
    }

    // Huella: registramos qué usuario está corriendo un bot creado por `creator`
    // (build). Si no coinciden, es un bot que salió del creador original → rastreable.
    try {
      await supabaseAdmin.from('bot_activations').upsert({
        build, creator, runner_user_id: k.user_id, account, magic,
        last_seen: new Date().toISOString(),
        foreign_run: !!creator && creator !== k.user_id,
      }, { onConflict: 'build,account' });
    } catch { /* tabla opcional: si no existe, la activación sigue funcionando */ }

    const until = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    return NextResponse.json({ allowed: true, until });
  } catch (e: any) {
    return NextResponse.json({ allowed: false, reason: 'error', detail: e?.message || '' }, { status: 200 });
  }
}
