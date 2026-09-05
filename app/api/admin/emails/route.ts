import { NextResponse } from 'next/server';
import { getAdmin, requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · bandeja de salida global: correos que envió el sistema (búsqueda opcional)
export async function GET(req: Request) {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const p = await requirePerm('usuarios', 'view'); if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  let query = supabaseAdmin.from('email_log').select('to_email,subject,kind,status,created_at').order('created_at', { ascending: false }).limit(200);
  if (q) query = query.or(`to_email.ilike.%${q}%,subject.ilike.%${q}%`);
  const { data } = await query;

  const { count: total } = await supabaseAdmin.from('email_log').select('id', { count: 'exact', head: true });
  return NextResponse.json({ emails: data || [], total: total || 0 });
}
