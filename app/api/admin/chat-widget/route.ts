import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { getSetting, saveSetting, chatWidgetSettings, type ChatWidget, type ChatTopic } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const oneOf = <T extends string>(v: any, allowed: T[], fb: T): T => (allowed.includes(v) ? v : fb);
const s = (v: any, fb: string, max = 200) => (v == null ? fb : String(v).slice(0, max));
const b = (v: any, fb: boolean) => (v == null ? fb : !!v);
const clampInt = (v: any, lo: number, hi: number, fb: number) => { const n = Math.round(Number(v)); return isNaN(n) ? fb : Math.min(hi, Math.max(lo, n)); };
const color = (v: any, fb: string) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v) : fb);

function cleanTopics(arr: any, fb: ChatTopic[]): ChatTopic[] {
  if (!Array.isArray(arr)) return fb;
  return arr.slice(0, 12).map((t: any) => ({
    q_es: s(t?.q_es, '', 200), q_en: s(t?.q_en, '', 200),
    label_es: s(t?.label_es, '', 40), label_en: s(t?.label_en, '', 40),
  })).filter((t) => t.label_es || t.label_en || t.q_es || t.q_en);
}

// GET · configuración del chat de soporte.
export async function GET() {
  const { ok } = await requirePerm('ajustes', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  return NextResponse.json(await chatWidgetSettings());
}

// PATCH · guardar (owner).
export async function PATCH(req: Request) {
  const { ok } = await requirePerm('ajustes', 'manage');
  if (!ok) return NextResponse.json({ error: 'Solo el Owner puede editar el chat.' }, { status: 403 });
  const prev = await getSetting<ChatWidget>('chat_widget', await chatWidgetSettings());
  const x = await req.json().catch(() => ({} as any));

  const value: ChatWidget = {
    enabled: b(x.enabled, prev.enabled),
    name_es: s(x.name_es, prev.name_es, 40), name_en: s(x.name_en, prev.name_en, 40),
    humanName_es: s(x.humanName_es, prev.humanName_es, 40), humanName_en: s(x.humanName_en, prev.humanName_en, 40),
    subOn_es: s(x.subOn_es, prev.subOn_es, 80), subOn_en: s(x.subOn_en, prev.subOn_en, 80),
    subOff_es: s(x.subOff_es, prev.subOff_es, 80), subOff_en: s(x.subOff_en, prev.subOff_en, 80),
    avatarUrl: s(x.avatarUrl, prev.avatarUrl, 400),
    headerEmoji: s(x.headerEmoji, prev.headerEmoji, 8),
    launcher: s(x.launcher, prev.launcher, 8),
    helpLabel_es: s(x.helpLabel_es, prev.helpLabel_es, 60), helpLabel_en: s(x.helpLabel_en, prev.helpLabel_en, 60),
    greeting_es: s(x.greeting_es, prev.greeting_es, 200), greeting_en: s(x.greeting_en, prev.greeting_en, 200),
    placeholder_es: s(x.placeholder_es, prev.placeholder_es, 80), placeholder_en: s(x.placeholder_en, prev.placeholder_en, 80),
    humanLabel_es: s(x.humanLabel_es, prev.humanLabel_es, 60), humanLabel_en: s(x.humanLabel_en, prev.humanLabel_en, 60),
    topicsTitle_es: s(x.topicsTitle_es, prev.topicsTitle_es, 60), topicsTitle_en: s(x.topicsTitle_en, prev.topicsTitle_en, 60),
    c1: color(x.c1, prev.c1), c2: color(x.c2, prev.c2), gradient: b(x.gradient, prev.gradient),
    fg: color(x.fg, prev.fg), accent: color(x.accent, prev.accent),
    showTopics: b(x.showTopics, prev.showTopics), showHuman: b(x.showHuman, prev.showHuman),
    showTicket: b(x.showTicket, prev.showTicket), showPulse: b(x.showPulse, prev.showPulse),
    topicsGuest: cleanTopics(x.topicsGuest, prev.topicsGuest),
    topicsUser: cleanTopics(x.topicsUser, prev.topicsUser),
    proactiveOn: b(x.proactiveOn, prev.proactiveOn),
    proactiveDelay: clampInt(x.proactiveDelay, 2, 120, prev.proactiveDelay),
    proactive_es: s(x.proactive_es, prev.proactive_es, 160), proactive_en: s(x.proactive_en, prev.proactive_en, 160),
    side: oneOf(x.side, ['right', 'left'], prev.side),
    hideDesktop: b(x.hideDesktop, prev.hideDesktop), hideTablet: b(x.hideTablet, prev.hideTablet), hideMobile: b(x.hideMobile, prev.hideMobile),
    launcherSize: clampInt(x.launcherSize, 40, 80, prev.launcherSize),
    offsetX: clampInt(x.offsetX, 0, 80, prev.offsetX), offsetY: clampInt(x.offsetY, 0, 120, prev.offsetY),
  };
  await saveSetting('chat_widget', value);
  return NextResponse.json({ ok: true, ...value });
}
