import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { NOTIF_CATALOG } from '@/lib/notifConfig';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Redacta con IA el título y cuerpo (ES + EN) de una notificación, según una
// instrucción del dueño (tono, longitud…). Mantiene las {variables}.
export async function POST(req: Request) {
  const a = await getAdmin();
  if (!a.isAdmin || a.role !== 'owner') return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: 'IA no configurada (ANTHROPIC_API_KEY).' }, { status: 400 });

  const b = await req.json().catch(() => ({} as any));
  const def = NOTIF_CATALOG.find((d) => d.key === b.key);
  if (!def) return NextResponse.json({ error: 'tipo inválido' }, { status: 400 });
  const instruction = String(b.instruction || '').slice(0, 500);

  const vars = Array.from(new Set((def.es.title + def.es.body + def.en.title + def.en.body).match(/\{\w+\}/g) || []));
  const system = `You write short push/in-app notification copy for a trading-journal app called Onyx Trading Live. Keep it concise (title ≤ 8 words, body ≤ 18 words), friendly and clear. NEVER remove or rename the placeholders in curly braces (${vars.join(', ') || 'none'}) — keep them exactly. Emojis are welcome but at most one per line. Return ONLY a JSON object: {"title_es":"","title_en":"","body_es":"","body_en":""}`;
  const user = `Notification type: "${def.key}" (${def.group}).\nCurrent ES title: ${def.es.title}\nCurrent ES body: ${def.es.body}\nCurrent EN title: ${def.en.title}\nCurrent EN body: ${def.en.body}\n\nOwner instruction: ${instruction || 'Improve clarity and warmth.'}`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.ONYX_AI_MODEL || 'claude-haiku-4-5', max_tokens: 400, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!r.ok) return NextResponse.json({ error: 'La IA no respondió.' }, { status: 400 });
    const d = await r.json();
    const raw = (d?.content || []).map((c: any) => c.text || '').join('\n').trim();
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    const j = JSON.parse(s >= 0 && e > s ? raw.slice(s, e + 1) : raw);
    return NextResponse.json({
      ok: true,
      title_es: String(j.title_es || '').slice(0, 140), title_en: String(j.title_en || '').slice(0, 140),
      body_es: String(j.body_es || '').slice(0, 300), body_en: String(j.body_en || '').slice(0, 300),
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'No pude leer la respuesta de la IA.' }, { status: 400 });
  }
}
