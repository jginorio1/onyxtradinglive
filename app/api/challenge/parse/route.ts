import { pickLang, langFromCookie } from '@/lib/i18n';
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { parseRules } from '@/lib/coachAI';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · lee con AI las reglas de una prop firm pegadas y devuelve los números
// para prellenar "Mi reto". No guarda nada: el trader confirma antes.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
    const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', (prof as any)?.plan || 'free').maybeSingle();
    if (!(plan?.capabilities as any)?.manager) return NextResponse.json({ error: 'plan' }, { status: 403 });

    const b = await req.json().catch(() => ({} as any));
    const lang = pickLang(b.lang);
    // Texto pegado (hasta ~15.000 caracteres para contratos largos) y/o archivo
    // (foto o PDF del contrato). La IA lee de cualquiera de las dos formas.
    const text = String(b.text || '').slice(0, 15000);
    let file: { media_type: string; data: string } | undefined;
    if (b.file && b.file.data && b.file.media_type) {
      const ok = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(String(b.file.media_type));
      // Límite de tamaño del base64 (~8 MB de archivo).
      if (ok && String(b.file.data).length < 11_000_000) file = { media_type: String(b.file.media_type), data: String(b.file.data) };
    }
    const r = await parseRules(file ? { text, file } : text, lang);
    if (!r.ok) {
      const msg = r.reason === 'no_key'
        ? (lang === 'en' ? 'AI not set up (ANTHROPIC_API_KEY).' : 'IA no configurada (ANTHROPIC_API_KEY).')
        : r.reason === 'short'
          ? (lang === 'en' ? 'Paste the rules or attach the contract.' : 'Pega las reglas o adjunta el contrato.')
          : (lang === 'en' ? "Couldn't read the rules. Paste the limits section or attach a clearer file." : 'No se pudieron leer las reglas. Pega la sección de límites o adjunta un archivo más claro.');
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ ok: true, rules: r.rules });
  } catch (e: any) {
    await logError('challenge_parse', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
