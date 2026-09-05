import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { createServiceRequest, notifyNewLead } from '@/lib/botlab';
import { serverLang } from '@/lib/locale';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST público · solicitud de servicio (automatiza / instalación / elite).
// Funciona con o sin sesión (captura de lead).
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const email = String(b.email || '').trim();
  if (!b.service) return NextResponse.json({ error: 'Elige un servicio.' }, { status: 400 });
  let userId: string | null = null;
  try { const { data: { user } } = await createSupabaseServer().auth.getUser(); userId = user?.id || null; } catch {}
  if (!userId && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Deja un correo válido para contactarte.' }, { status: 400 });
  const lang = serverLang();
  const r = await createServiceRequest({
    userId, email: email || undefined, name: b.name ? String(b.name).slice(0, 80) : undefined,
    service: String(b.service), platform: b.platform ? String(b.platform).slice(0, 20) : undefined,
    budget: b.budget ? String(b.budget).slice(0, 40) : undefined, message: b.message ? String(b.message) : undefined,
    lang,
  });
  // Aviso inmediato al dueño (correo + Telegram). No bloquea la respuesta.
  notifyNewLead({ service: String(b.service), name: b.name, email, platform: b.platform, budget: b.budget, message: b.message, lang }).catch(() => {});
  return NextResponse.json({ ok: true, id: r?.id });
}
