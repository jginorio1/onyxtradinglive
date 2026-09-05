import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · registro de actividad del equipo (auditoría). ?member=email filtra por uno.
export async function GET(req: Request) {
  try {
    const { ok } = await requirePerm('equipo', 'view');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    const member = new URL(req.url).searchParams.get('member') || '';
    let q = supabaseAdmin.from('admin_log').select('admin_email,action,target,meta,created_at').order('created_at', { ascending: false }).limit(100);
    if (member) q = q.eq('admin_email', member);
    const { data } = await q;
    return NextResponse.json({ log: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
