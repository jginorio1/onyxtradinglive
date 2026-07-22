import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · ata al usuario recién registrado con el embajador de su cookie.
// Se llama desde el dashboard al entrar; es idempotente y silencioso.
export async function POST() {
  try {
    const code = cookies().get('onyx_ref')?.value;
    if (!code) return NextResponse.json({ ok: true, linked: false });

    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ ok: true, linked: false });

    // ¿ya está atado? entonces no tocamos nada (la atribución es de por vida)
    const { data: prev } = await supabaseAdmin.from('referrals').select('id').eq('user_id', user.id).maybeSingle();
    if (prev) return NextResponse.json({ ok: true, linked: false });

    const { data: amb } = await supabaseAdmin.from('ambassadors').select('id,user_id,status').eq('code', code.toLowerCase()).maybeSingle();
    if (!amb || amb.status !== 'approved') return NextResponse.json({ ok: true, linked: false });

    // nadie se refiere a sí mismo
    if (amb.user_id === user.id) return NextResponse.json({ ok: true, linked: false });

    await supabaseAdmin.from('referrals').insert({ ambassador_id: amb.id, user_id: user.id, source: 'link' });
    await supabaseAdmin.from('profiles').update({ referred_by: amb.id }).eq('id', user.id);

    return NextResponse.json({ ok: true, linked: true });
  } catch {
    return NextResponse.json({ ok: true, linked: false });
  }
}

// GET · cuenta un clic en el enlace del embajador (lo llama la landing)
export async function GET(req: Request) {
  try {
    const code = new URL(req.url).searchParams.get('code');
    if (code && /^[a-zA-Z0-9_-]{2,30}$/.test(code)) {
      await supabaseAdmin.from('ref_clicks').insert({ code: code.toLowerCase() });
    }
  } catch { /* silencioso */ }
  return NextResponse.json({ ok: true });
}
