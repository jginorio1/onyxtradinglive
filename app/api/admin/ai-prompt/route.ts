import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { getSetting, saveSetting, type AiPrompt } from '@/lib/settings';
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
    return NextResponse.json({ ...cfg, defaultBrief_es: ONYX_BRIEF.es, defaultBrief_en: ONYX_BRIEF.en });
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
    await logAdmin(g.user?.email || '', 'ai_prompt_save', 'support_ai', {});
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await logError('ai_prompt_save', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
