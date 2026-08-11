import { pickLang, langFromCookie } from '@/lib/i18n';
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { parseRules } from '@/lib/coachAI';
import { getSetting, saveSetting } from '@/lib/settings';
import { PROP_TEMPLATES } from '@/lib/manager';
import { logError } from '@/lib/errlog';

// Añade al catálogo de prop firms una firma que la IA detectó del contrato y que
// aún no existe, para que la lista crezca (queda disponible para todos). Devuelve
// la plantilla nueva, o null si ya existía o el nombre no es válido.
async function growFirmCatalog(rules: any): Promise<any | null> {
  try {
    const name = String(rules?.firm || '').trim();
    if (name.length < 2 || name.length > 40) return null;
    const st = await getSetting<{ list: any[] }>('prop_templates', { list: [] });
    // Si el ajuste está vacío, sembramos los defaults para no perderlos al guardar.
    const list: any[] = (st?.list?.length ? st.list.slice() : (PROP_TEMPLATES as any[]).slice());
    const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const key = norm(name);
    if (!key) return null;
    if (list.some((x) => norm(x.name) === key || norm(x.name_en) === key)) return null;   // ya existe
    if (list.length > 300) return null;                                                    // tope de seguridad
    const t = {
      id: 'ai_' + key.slice(0, 24) + '_' + Date.now().toString(36),
      name, name_en: name,
      daily_loss: Number(rules.daily_loss) || 0, total_loss: Number(rules.total_loss) || 0,
      base: 'day_start_balance', reset_hour: 0,
      profit_target: Number(rules.profit_target) || 0,
      min_days: Number(rules.min_days) || 0, consistency: Number(rules.consistency) || 0,
      hint: 'Añadida automáticamente desde un contrato leído con IA. | Auto-added from a contract read by AI.',
      ai_added: true,
    };
    list.push(t);
    await saveSetting('prop_templates', { list });
    return t;
  } catch { return null; }
}

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
    const text = String(b.text || '').slice(0, 30000);
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
      // Código de diagnóstico discreto para saber en qué etapa falló (error IA / parseo / sin datos).
      const diag = ['error', 'parse', 'empty'].includes(String(r.reason)) ? ` (${r.reason})` : '';
      return NextResponse.json({ error: msg + diag }, { status: 400 });
    }
    // Si la firma detectada no está en el catálogo, se añade (y crece la lista).
    let addedFirm: any = null;
    if (r.rules?.firm) addedFirm = await growFirmCatalog(r.rules);
    return NextResponse.json({ ok: true, rules: r.rules, addedFirm });
  } catch (e: any) {
    await logError('challenge_parse', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
