import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Guarda los TAGS PROPIOS del trader (los que crea con "+ Añadir") en
// profiles.journal_tags. Se guarda la lista completa por grupo; en la UI se
// combinan con los tags por defecto. Así el panel se adapta a su estilo.
const GROUPS = ['setups', 'emotions', 'markets', 'errors'] as const;

function clean(v: any): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of v) {
    const s = String(x || '').trim().slice(0, 40);
    if (s && !seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s); }
    if (out.length >= 40) break;
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const b = await req.json().catch(() => ({} as any));
    // Partimos de lo que ya tenía guardado y solo pisamos los grupos que llegan.
    const { data: prof } = await supabaseAdmin.from('profiles').select('journal_tags').eq('id', user.id).maybeSingle();
    const cur: any = (prof?.journal_tags && typeof prof.journal_tags === 'object') ? prof.journal_tags : {};
    const next: any = {};
    for (const g of GROUPS) next[g] = clean(b[g] !== undefined ? b[g] : cur[g]);

    const { error } = await supabaseAdmin.from('profiles').update({ journal_tags: next }).eq('id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, customTags: next });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
