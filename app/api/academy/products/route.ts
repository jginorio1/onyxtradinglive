import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getMentor } from '@/lib/academy';
import { listProducts, saveProduct, deleteProduct, mentorEarnings } from '@/lib/academyPay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { user: null as any, caps: {} as any };
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', (prof as any)?.plan || 'free').maybeSingle();
  return { user, caps: (plan?.capabilities as any) || {} };
}

// GET · ?m=mentorId → lista pública de niveles activos de esa academia.
//       sin ?m → niveles del mentor actual + sus ingresos (requiere capacidad).
export async function GET(req: Request) {
  const m = new URL(req.url).searchParams.get('m');
  if (m) return NextResponse.json({ products: await listProducts(m, true) });
  const { user, caps } = await me();
  if (!user || !caps?.academy) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const [products, earnings] = await Promise.all([listProducts(user.id, false), mentorEarnings(user.id)]);
  return NextResponse.json({ products, earnings });
}

// POST · crear/editar/borrar un nivel (solo el mentor).
export async function POST(req: Request) {
  const { user, caps } = await me();
  if (!user || !caps?.academy) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const mentor = await getMentor(user.id);
  if (!mentor) return NextResponse.json({ error: 'no_mentor' }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === 'delete' && b.id) { await deleteProduct(user.id, String(b.id)); return NextResponse.json({ ok: true }); }
    const r = await saveProduct(user.id, b);
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}
