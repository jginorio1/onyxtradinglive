import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { salesSettings } from '@/lib/sales';
import { submitReview } from '@/lib/salesPerf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DAY = 86400000;

// GET · ¿este cliente puede/deber reseñar a su vendedor?
// Devuelve el vendedor asignado y si toca pedir reseña (según ajustes + antigüedad).
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ eligible: false });
  const s = await salesSettings();
  if (!s.review?.enabled) return NextResponse.json({ eligible: false });

  const { data: sc } = await supabaseAdmin.from('sales_clients').select('rep_id,created_at,first_paid_at').eq('user_id', user.id).maybeSingle();
  if (!sc) return NextResponse.json({ eligible: false });
  const repId = (sc as any).rep_id;

  // Antigüedad como cliente (desde que se ató).
  const since = new Date((sc as any).first_paid_at || (sc as any).created_at).getTime();
  if (Date.now() - since < (s.review.after_days || 20) * DAY) return NextResponse.json({ eligible: false });

  // No repetir si ya reseñó en los últimos 90 días.
  const { data: prev } = await supabaseAdmin.from('sales_reviews').select('created_at').eq('rep_id', repId).eq('client_user_id', user.id).order('created_at', { ascending: false }).limit(1);
  if (prev && prev[0] && Date.now() - new Date((prev[0] as any).created_at).getTime() < 90 * DAY) return NextResponse.json({ eligible: false });

  // Nombre del vendedor (para mostrar “¿Cómo te atendió X?”).
  const { data: rep } = await supabaseAdmin.from('sales_reps').select('user_id,display_name').eq('id', repId).maybeSingle();
  let repName = (rep as any)?.display_name || null;
  if (!repName && (rep as any)?.user_id) { const { data: p } = await supabaseAdmin.from('profiles').select('name,email').eq('id', (rep as any).user_id).maybeSingle(); repName = (p as any)?.name || (p as any)?.email || 'tu asesor'; }
  return NextResponse.json({ eligible: true, rep_id: repId, rep_name: repName });
}

// POST · el cliente envía su reseña (interna: solo la ve el supervisor y el admin).
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  // Verifica que el rep sea realmente el suyo (no puede reseñar a cualquiera).
  const { data: sc } = await supabaseAdmin.from('sales_clients').select('rep_id').eq('user_id', user.id).maybeSingle();
  const repId = (sc as any)?.rep_id;
  if (!repId || (b.rep_id && b.rep_id !== repId)) return NextResponse.json({ ok: false, error: 'sin vendedor asignado' }, { status: 400 });
  const r = await submitReview({ repId, clientUserId: user.id, rating: Number(b.rating), comment: b.comment, source: 'prompt' });
  return NextResponse.json(r);
}
