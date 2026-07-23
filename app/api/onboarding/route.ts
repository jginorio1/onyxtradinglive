import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ensureProfile } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Valores permitidos, para no guardar basura que venga del cliente.
const ALLOW: Record<string, string[]> = {
  experience: ['novato', 'intermedio', 'avanzado', 'pro'],
  trade_style: ['scalping', 'day', 'swing', 'position'],
  platform: ['mt4', 'mt5', 'ambas'],
  goal: ['pasar_challenge', 'consistencia', 'crecer', 'vivir'],
};

// POST · guarda el perfil de trader del onboarding y marca onboarded_at.
// Con { skip: true } solo marca la fecha (el usuario lo saltó).
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

    await ensureProfile(user.id, user.email);

    const b = await req.json().catch(() => ({}));
    const fields: any = { onboarded_at: new Date().toISOString() };

    if (!b?.skip) {
      // Texto libre acotado
      ['full_name', 'country', 'prop_firm'].forEach((k) => {
        if (b[k] !== undefined) fields[k] = String(b[k] || '').slice(0, 120);
      });
      // Campos de lista: solo si el valor es uno de los permitidos
      Object.keys(ALLOW).forEach((k) => {
        if (b[k] !== undefined && ALLOW[k].includes(String(b[k]))) fields[k] = String(b[k]);
      });
    }

    const { error } = await supabaseAdmin.from('profiles').update(fields).eq('id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
