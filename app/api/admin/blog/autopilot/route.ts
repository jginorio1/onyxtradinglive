import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { getSetting, saveSetting, blogAutopilotSettings, blogKeywordsSettings, type BlogAutopilot } from '@/lib/settings';
import { listAllPosts } from '@/lib/blog';
import { planMonth, fillDueSlots, nextDates } from '@/lib/blogAutopilot';
import { suggestTopics, lastAiError } from '@/lib/blogAI';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const cleanList = (v: any): string[] => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 60)
  : String(v || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 60));
const clampN = (v: any, min: number, max: number, fb: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fb; };

// GET · ajustes + fechas ya programadas (para pintar el calendario) + próximas previstas.
export async function GET() {
  const { ok } = await requirePerm('modulos', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const settings = await blogAutopilotSettings();
  let posts: any[] = [];
  try { posts = await listAllPosts(); } catch {}
  const scheduled = posts.filter((p) => p.status === 'scheduled' && p.publish_at).map((p) => ({
    id: p.id, title: p.title_es || p.title_en || '(tema)', publish_at: p.publish_at,
    ready: !!(String(p.body_es || '').trim() || String(p.body_en || '').trim()),
  })).sort((a, b) => new Date(a.publish_at).getTime() - new Date(b.publish_at).getTime());
  const upcoming = await nextDates(settings.perMonth || 15);
  return NextResponse.json({ settings, scheduled, upcoming });
}

// PATCH · guardar ajustes del piloto automático.
export async function PATCH(req: Request) {
  const { ok } = await requirePerm('modulos', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const prev = await getSetting<BlogAutopilot>('blog_autopilot', await blogAutopilotSettings());
  const b = await req.json().catch(() => ({} as any));
  const value: BlogAutopilot = {
    enabled: b.enabled == null ? prev.enabled : !!b.enabled,
    everyNDays: clampN(b.everyNDays, 1, 14, prev.everyNDays),
    hour: clampN(b.hour, 0, 23, prev.hour),
    perMonth: clampN(b.perMonth, 1, 40, prev.perMonth),
    useKeywords: b.useKeywords == null ? prev.useKeywords : !!b.useKeywords,
    topics: b.topics == null ? prev.topics : cleanList(b.topics),
    usedTopics: prev.usedTopics || [],
    autoReplenish: b.autoReplenish == null ? prev.autoReplenish : !!b.autoReplenish,
    tzOffset: Number.isFinite(Number(b.tzOffset)) ? Math.round(Number(b.tzOffset)) : (prev.tzOffset || 0),
  };
  await saveSetting('blog_autopilot', value);
  return NextResponse.json({ ok: true, settings: value });
}

// POST · acciones: { action: 'plan' | 'fill' }
//   plan → crea las fechas del mes (calendario lleno). fill → genera ya la próxima pendiente.
export async function POST(req: Request) {
  const { ok } = await requirePerm('modulos', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    const action = String(b.action || '');
    if (action === 'plan') {
      const cfg = await blogAutopilotSettings();
      if (!(cfg.topics?.length) && !cfg.useKeywords) return NextResponse.json({ error: 'sin_temas', code: 'sin_temas' }, { status: 200 });
      const r = await planMonth(b.count ? clampN(b.count, 1, 40, cfg.perMonth) : undefined);
      if (!r.created.length) return NextResponse.json({ error: 'sin_temas', code: 'sin_temas' }, { status: 200 });
      return NextResponse.json({ ok: true, created: r.created });
    }
    if (action === 'fill') {
      // all=true genera cualquier fecha vacía (para "Generar todas ahora", en bucle
      // desde el navegador: 1 por petición para no chocar con el timeout serverless).
      const r = await fillDueSlots(1, { all: !!b.all });
      return NextResponse.json({ ok: true, ...r });
    }
    // Ampliar el pool de temas con IA (para que dure meses/años sin repetir).
    if (action === 'topics') {
      const cfg = await blogAutopilotSettings();
      const kw = await blogKeywordsSettings();
      const count = clampN(b.count, 10, 120, 60);
      const r = await suggestTopics(count, cfg.topics || [], [...(kw.es || []), ...(kw.en || [])]);
      if (!r.ok || !r.topics?.length) return NextResponse.json({ error: r.reason || 'ai', code: r.reason, detail: lastAiError() }, { status: 200 });
      const merged = [...(cfg.topics || []), ...r.topics].slice(0, 500);
      await saveSetting('blog_autopilot', { ...cfg, topics: merged });
      return NextResponse.json({ ok: true, added: r.topics.length, topics: merged });
    }
    return NextResponse.json({ error: 'acción inválida' }, { status: 400 });
  } catch (e: any) {
    await logError('blog_autopilot', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
