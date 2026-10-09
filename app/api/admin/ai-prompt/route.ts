import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { getSetting, saveSetting, type AiPrompt, type RecoBroker, RECO_BROKER_DEFAULT } from '@/lib/settings';
import { ONYX_BRIEF } from '@/lib/supportAI';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const KEY = 'support_ai_prompt';
const DEF: AiPrompt = { brief_es: '', brief_en: '', extra_es: '', extra_en: '' };

// Prompt editable de Onyx AI (soporte/chat). GET también devuelve el conocimiento por
// defecto del código, para que el admin pueda cargarlo y editarlo desde cero.
export async function GET() {
  try {
    const { ok } = await requirePerm('soporte', 'view');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const cfg = await getSetting<AiPrompt>(KEY, DEF);
    const broker = await getSetting<RecoBroker>('reco_broker', RECO_BROKER_DEFAULT);
    return NextResponse.json({ ...cfg, broker, defaultBrief_es: ONYX_BRIEF.es, defaultBrief_en: ONYX_BRIEF.en });
  } catch (e: any) {
    await logError('ai_prompt_get', e);
    return NextResponse.json({ ...DEF });
  }
}

export async function POST(req: Request) {
  try {
    const g = await requirePerm('soporte', 'manage');
    if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const b = await req.json().catch(() => ({} as any));
    const clean = (s: any, n = 8000) => (s == null ? '' : String(s).slice(0, n));
    const val: AiPrompt = {
      brief_es: clean(b.brief_es), brief_en: clean(b.brief_en),
      extra_es: clean(b.extra_es, 4000), extra_en: clean(b.extra_en, 4000),
    };
    await saveSetting(KEY, val);
    // Bróker recomendado (afiliado) — opcional en el mismo guardado.
    if (b.broker && typeof b.broker === 'object') {
      const br = b.broker as any;
      const broker: RecoBroker = {
        enabled: !!br.enabled,
        name: clean(br.name, 60),
        url: clean(br.url, 500),
        blurb_es: clean(br.blurb_es, 300),
        blurb_en: clean(br.blurb_en, 300),
      };
      await saveSetting('reco_broker', broker);
    }
    await logAdmin(g.user?.email || '', 'ai_prompt_save', 'support_ai', {});
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await logError('ai_prompt_save', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
