import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { parseReceipt } from '@/lib/coachAI';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function hasExpenses(userId: string): Promise<boolean> {
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', userId).maybeSingle();
  const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', (prof as any)?.plan || 'free').maybeSingle();
  return !!(plan?.capabilities as any)?.expenses;
}

// POST · lee con AI un recibo/correo y devuelve los campos para prellenar el form.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    if (!(await hasExpenses(user.id))) return NextResponse.json({ error: 'plan' }, { status: 403 });
    const b = await req.json().catch(() => ({} as any));
    const lang = b.lang === 'en' ? 'en' : 'es';
    const r = await parseReceipt(String(b.text || '').slice(0, 4000), lang);
    if (!r.ok) {
      const msg = r.reason === 'no_key' ? (lang === 'en' ? 'AI not set up.' : 'IA no configurada.')
        : r.reason === 'short' ? (lang === 'en' ? 'Paste the receipt text.' : 'Pega el texto del recibo.')
          : (lang === 'en' ? "Couldn't read that receipt." : 'No se pudo leer ese recibo.');
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ ok: true, data: r.data });
  } catch (e: any) {
    await logError('expenses_read', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
