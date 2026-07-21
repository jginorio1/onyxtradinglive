import { NextResponse } from 'next/server';
import { getAdmin, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · si eres admin devuelve TODOS los planes; si no, solo los activos (para /pricing).
export async function GET() {
  const { isAdmin } = await getAdmin();
  let q = supabaseAdmin.from('plans').select('*').order('sort', { ascending: true });
  if (!isAdmin) q = q.eq('active', true) as any;
  const { data } = await q;
  return NextResponse.json({ plans: data || [] });
}

// POST · crear plan nuevo
export async function POST(req: Request) {
  const { isAdmin, user } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json();
  if (!b.id || !b.name) return NextResponse.json({ error: 'id y nombre son obligatorios' }, { status: 400 });
  const row = {
    id: String(b.id).toLowerCase().replace(/[^a-z0-9_-]/g, ''),
    name: b.name,
    name_en: b.name_en || b.name,
    desc_es: b.desc_es || null,
    desc_en: b.desc_en || null,
    price_month: Number(b.price_month) || 0,
    price_year: Number(b.price_year) || 0,
    stripe_price_id: b.stripe_price_id || null,
    stripe_price_id_year: b.stripe_price_id_year || null,
    max_accounts: Number(b.max_accounts) || 1,
    features: Array.isArray(b.features) ? b.features : [],
    features_en: Array.isArray(b.features_en) ? b.features_en : [],
    badge: b.badge || null,
    badge_en: b.badge_en || null,
    active: b.active !== false,
    sort: Number(b.sort) || 0,
  };
  const { error } = await supabaseAdmin.from('plans').insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdmin(user.email, 'create_plan', row.id, {});
  return NextResponse.json({ ok: true });
}

// PATCH · editar plan existente
export async function PATCH(req: Request) {
  const { isAdmin, user } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
  const fields: any = { updated_at: new Date().toISOString() };
  ['name', 'name_en', 'desc_es', 'desc_en', 'stripe_price_id', 'stripe_price_id_year', 'badge', 'badge_en'].forEach((k) => { if (b[k] !== undefined) fields[k] = b[k]; });
  ['price_month', 'price_year', 'max_accounts', 'sort'].forEach((k) => { if (b[k] !== undefined) fields[k] = Number(b[k]) || 0; });
  if (b.features !== undefined) fields.features = Array.isArray(b.features) ? b.features : [];
  if (b.features_en !== undefined) fields.features_en = Array.isArray(b.features_en) ? b.features_en : [];
  if (b.active !== undefined) fields.active = !!b.active;
  const { error } = await supabaseAdmin.from('plans').update(fields).eq('id', b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdmin(user.email, 'edit_plan', b.id, fields);
  return NextResponse.json({ ok: true });
}

// DELETE · borrar plan
export async function DELETE(req: Request) {
  const { isAdmin, user } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
  if (id === 'free') return NextResponse.json({ error: 'no se puede borrar el plan free' }, { status: 400 });
  const { error } = await supabaseAdmin.from('plans').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdmin(user.email, 'delete_plan', id, {});
  return NextResponse.json({ ok: true });
}
