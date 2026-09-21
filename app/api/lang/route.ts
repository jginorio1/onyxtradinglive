import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Guarda el idioma elegido en el perfil del usuario (profiles.lang). El selector de
// idioma de la app solo escribía una cookie, así que profiles.lang se quedaba en el
// del registro y los push/emails salían en el idioma "viejo". Ahora, al cambiar el
// idioma en la app, también se guarda aquí para que los avisos coincidan.
// Idiomas guardados: 'es' o 'en' (los avisos solo tienen esos dos; los demás caen a en).
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 200 }); // sin sesión: no romper
    const b = await req.json().catch(() => ({} as any));
    const raw = String(b?.lang || '').toLowerCase();
    const lang = raw === 'es' ? 'es' : 'en';   // avisos/emails: solo es/en
    await supabaseAdmin.from('profiles').update({ lang }).eq('id', user.id);
    return NextResponse.json({ ok: true, lang });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
