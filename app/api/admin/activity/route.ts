import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · registro de actividad del equipo (auditoría), historial COMPLETO filtrado
// y paginado en la BD (sin tope de 100). Parámetros:
//   ?member=email   filtra por un empleado
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD   rango de fechas (inclusivo)
//   ?q=texto        busca en acción/destino (ilike)
//   ?limit=200&offset=0   paginación ("cargar más")
// Devuelve { log, total, hasMore }.
export async function GET(req: Request) {
  try {
    const { ok } = await requirePerm('equipo', 'view');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    const sp = new URL(req.url).searchParams;
    const member = sp.get('member') || '';
    const from = sp.get('from') || '';
    const to = sp.get('to') || '';
    const q = (sp.get('q') || '').trim();
    const limit = Math.min(1000, Math.max(1, parseInt(sp.get('limit') || '200', 10) || 200));
    const offset = Math.max(0, parseInt(sp.get('offset') || '0', 10) || 0);

    // Selección con columnas nuevas (ip/user_agent/area); si no existen aún,
    // reintenta con el set básico para no romper.
    const cols = 'admin_email,action,target,meta,created_at,ip,user_agent,area';
    function build(sel: string) {
      let qq = supabaseAdmin.from('admin_log').select(sel, { count: 'exact' }).order('created_at', { ascending: false });
      if (member) qq = qq.eq('admin_email', member);
      if (from) qq = qq.gte('created_at', new Date(from + 'T00:00:00').toISOString());
      if (to) qq = qq.lte('created_at', new Date(to + 'T23:59:59').toISOString());
      if (q) qq = qq.or(`action.ilike.%${q}%,target.ilike.%${q}%`);
      return qq.range(offset, offset + limit - 1);
    }
    let res = await build(cols);
    if (res.error) res = await build('admin_email,action,target,meta,created_at');

    const log = res.data || [];
    const total = res.count ?? log.length;
    return NextResponse.json({ log, total, hasMore: offset + log.length < total });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', log: [] }, { status: 500 });
  }
}
