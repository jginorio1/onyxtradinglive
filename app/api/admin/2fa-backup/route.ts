import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { genBackupCodes, backupCodesLeft, verifyBackupCode, set2faOk } from '@/lib/adminSecurity';
import { logAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ¿La sesión superó el 2FA real (TOTP) ahora mismo? Solo así se pueden generar
// códigos de respaldo (evita que alguien en aal1 se cree sus propios códigos).
async function isAal2(): Promise<boolean> {
  try {
    const { data } = await createSupabaseServer().auth.mfa.getAuthenticatorAssuranceLevel();
    return data?.currentLevel === 'aal2';
  } catch { return false; }
}

// GET · cuántos códigos de respaldo quedan.
export async function GET() {
  const { user, isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  return NextResponse.json({ left: await backupCodesLeft(user.id) });
}

// POST · generar (requiere 2FA real) o verificar un código de respaldo.
export async function POST(req: Request) {
  const { user, isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({}));

  if (b.action === 'generate') {
    if (!(await isAal2())) return NextResponse.json({ error: 'Verifica primero tu 2FA para generar códigos.' }, { status: 401 });
    const codes = await genBackupCodes(user.id);
    await logAdmin(user.email || '', '2fa_backup_generate', user.id, {});
    return NextResponse.json({ codes });
  }

  if (b.action === 'verify') {
    const ok = await verifyBackupCode(user.id, String(b.code || ''));
    if (!ok) return NextResponse.json({ error: 'Código incorrecto o ya usado.' }, { status: 401 });
    set2faOk(user.id);   // esta sesión queda como "2FA satisfecho" (8 h)
    await logAdmin(user.email || '', '2fa_backup_used', user.id, { left: await backupCodesLeft(user.id) });
    return NextResponse.json({ ok: true, left: await backupCodesLeft(user.id) });
  }

  return NextResponse.json({ error: 'acción no válida' }, { status: 400 });
}
