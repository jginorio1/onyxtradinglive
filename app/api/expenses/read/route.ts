import { pickLang, langFromCookie } from '@/lib/i18n';
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
    const lang = pickLang(b.lang);

    // Archivo adjunto (imagen o PDF) o texto pegado.
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    let input: any = String(b.text || '').slice(0, 4000);
    if (b.file && b.file.data && allowed.includes(b.file.media_type)) {
      if (String(b.file.data).length > 9_000_000) { // ~6-7 MB de archivo
        return NextResponse.json({ error: lang === 'en' ? 'File too large (max ~6 MB).' : 'Archivo muy grande (máx ~6 MB).' }, { status: 400 });
      }
      input = { text: String(b.text || '').slice(0, 2000), file: { media_type: b.file.media_type, data: String(b.file.data) } };
    }

    const r = await parseReceipt(input, lang);
    if (!r.ok) {
      const msg = r.reason === 'no_key' ? (lang === 'en' ? 'AI not set up.' : 'IA no configurada.')
        : r.reason === 'short' ? (lang === 'en' ? 'Attach a receipt or paste its text.' : 'Adjunta un recibo o pega su texto.')
          : (lang === 'en' ? "Couldn't read that receipt. Try a clearer file or paste the text." : 'No se pudo leer ese recibo. Prueba un archivo más claro o pega el texto.');
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ ok: true, data: r.data });
  } catch (e: any) {
    await logError('expenses_read', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
