import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { coreSecurityItems, summarize, type SecItem } from '@/lib/securityAudit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Auditoría de seguridad en vivo: corre cada vez que se abre el tab Audit.
export async function GET() {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const items: SecItem[] = await coreSecurityItems();

  // 2FA del admin actual (necesita la sesión, por eso va aquí y no en el core).
  try {
    const sb = createSupabaseServer();
    const { data: f } = await sb.auth.mfa.listFactors();
    const has2fa = (f?.totp || []).some((x: any) => x.status === 'verified');
    items.push({ key: 'mfa', es: '2FA de tu cuenta admin', en: 'Your admin 2FA', status: has2fa ? 'ok' : 'fail', hintEs: 'Actívalo en Mi cuenta → Seguridad', hintEn: 'Enable it in My account → Security' });
  } catch { items.push({ key: 'mfa', es: '2FA de tu cuenta admin', en: 'Your admin 2FA', status: 'warn' }); }

  return NextResponse.json({ at: new Date().toISOString(), ...summarize(items), items });
}
