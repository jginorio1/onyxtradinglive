import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SITE } from '@/lib/locale';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Ping de calentamiento. Corre por cron cada pocos minutos para que ni las
// funciones serverless ni la base de datos se "duerman" (cold start). Hace lo
// mínimo: una lectura diminuta a Supabase + una petición a la home para
// mantener caliente la función que sirve las páginas. Barato y sin efectos.
// ============================================================
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // sin secreto configurado, no bloqueamos el cron
  const auth = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${secret}` || q === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const out: { db: boolean; home: boolean } = { db: false, home: false };

  // 1) Lectura mínima → mantiene despierta la base de datos.
  try {
    await supabaseAdmin.from('app_settings').select('key').limit(1);
    out.db = true;
  } catch { /* si falla, no pasa nada */ }

  // 2) Toca la home → mantiene caliente la función que renderiza las páginas.
  try {
    const r = await fetch(`${SITE}/`, { headers: { 'x-onyx-warm': '1' }, cache: 'no-store' });
    out.home = r.ok;
  } catch { /* idem */ }

  return NextResponse.json({ ok: true, ...out, at: new Date().toISOString() });
}
