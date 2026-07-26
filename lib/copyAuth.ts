import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Autentica una petición de EA por su API key (Bearer o x-onyx-key) y devuelve
// la cuenta de trading a la que pertenece esa clave. Mismo criterio que /api/v1/sync.
export async function authAccount(req: Request): Promise<{ userId: string; account: any } | null> {
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const key = bearer || req.headers.get('x-onyx-key') || '';
  if (!key) return null;

  const { data: keyRow } = await supabaseAdmin.from('api_keys')
    .select('user_id,revoked,account_login').eq('key', key).maybeSingle();
  if (!keyRow || keyRow.revoked || keyRow.account_login == null) return null;

  const { data: acc } = await supabaseAdmin.from('trading_accounts')
    .select('id,login,balance,user_id,nickname,broker')
    .eq('user_id', keyRow.user_id).eq('login', keyRow.account_login).maybeSingle();
  if (!acc) return null;

  return { userId: keyRow.user_id, account: acc };
}
