import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { salesSettings, saveSalesSettings, uniqueRepCode, balances } from '@/lib/sales';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LEVELS = ['vendedor', 'l1', 'l2'];

// GET · solicitudes + red (reps con saldos) + ajustes. Base del panel admin.
export async function GET() {
  const { ok } = await requirePerm('modulos', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const settings = await salesSettings();
  const { data: apps } = await supabaseAdmin.from('sales_applications').select('*').order('created_at', { ascending: false }).limit(200);
  const { data: reps } = await supabaseAdmin.from('sales_reps').select('*').order('created_at', { ascending: true });

  // Enriquecer cada rep con correo, nº de clientes y saldos.
  const list: any[] = [];
  for (const r of (reps || []) as any[]) {
    const { data: prof } = await supabaseAdmin.from('profiles').select('email').eq('id', r.user_id).maybeSingle();
    const { count: clients } = await supabaseAdmin.from('sales_clients').select('*', { count: 'exact', head: true }).eq('rep_id', r.id);
    const bal = await balances(r.id);
    list.push({ ...r, email: (prof as any)?.email || null, clients: clients || 0, balances: bal });
  }
  return NextResponse.json({ settings, applications: apps || [], reps: list });
}

// POST · acciones de gestión.
export async function POST(req: Request) {
  const { ok } = await requirePerm('modulos', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const action = String(b.action || '');

  try {
    if (action === 'save_settings') {
      const s = await saveSalesSettings(b.settings || {});
      return NextResponse.json({ ok: true, settings: s });
    }

    // Crear un rep a partir de un correo (aprobación o alta manual).
    if (action === 'approve' || action === 'create_rep') {
      const email = String(b.email || '').trim().toLowerCase();
      const level = LEVELS.includes(b.level) ? b.level : 'vendedor';
      const parent_id = b.parent_id || null;
      const { data: prof } = await supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle();
      if (!prof) return NextResponse.json({ ok: false, error: 'El candidato debe tener una cuenta en la app primero (con ese correo).' }, { status: 400 });
      const uid = (prof as any).id;
      const { data: exists } = await supabaseAdmin.from('sales_reps').select('id').eq('user_id', uid).maybeSingle();
      let repId = (exists as any)?.id;
      if (repId) {
        await supabaseAdmin.from('sales_reps').update({ level, parent_id, status: 'active' }).eq('id', repId);
      } else {
        const code = await uniqueRepCode(email.split('@')[0] || 'sv');
        const { data: created } = await supabaseAdmin.from('sales_reps')
          .insert({ user_id: uid, level, parent_id, code, status: 'active', display_name: b.display_name || null, approved_at: new Date().toISOString() })
          .select('id').maybeSingle();
        repId = (created as any)?.id;
      }
      if (action === 'approve' && b.app_id) {
        await supabaseAdmin.from('sales_applications').update({ status: 'approved', rep_id: repId, reviewed_at: new Date().toISOString() }).eq('id', b.app_id);
      }
      return NextResponse.json({ ok: true, rep_id: repId });
    }

    if (action === 'reject' && b.app_id) {
      await supabaseAdmin.from('sales_applications').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', b.app_id);
      return NextResponse.json({ ok: true });
    }

    // Editar un rep: nivel, padre, % override, freno, alias de correo, estado.
    if (action === 'set_rep' && b.rep_id) {
      const patch: any = {};
      if (b.level != null && LEVELS.includes(b.level)) patch.level = b.level;
      if (b.parent_id !== undefined) patch.parent_id = b.parent_id || null;
      if (b.rate_override !== undefined) patch.rate_override = b.rate_override === '' || b.rate_override == null ? null : Number(b.rate_override);
      if (b.on_hold !== undefined) patch.on_hold = !!b.on_hold;
      if (b.status && ['active', 'paused', 'removed'].includes(b.status)) patch.status = b.status;
      if (b.display_name !== undefined) patch.display_name = String(b.display_name || '').slice(0, 80) || null;
      if (b.from_name !== undefined) patch.from_name = String(b.from_name || '').slice(0, 80) || null;
      if (b.from_alias !== undefined) patch.from_alias = String(b.from_alias || '').slice(0, 120) || null;
      if (b.reply_to !== undefined) patch.reply_to = String(b.reply_to || '').slice(0, 160) || null;
      if (b.note !== undefined) patch.note = String(b.note || '').slice(0, 500) || null;
      await supabaseAdmin.from('sales_reps').update(patch).eq('id', b.rep_id);
      return NextResponse.json({ ok: true });
    }

    // Asignar un cliente (por correo) a un rep.
    if (action === 'assign_client' && b.rep_id && b.email) {
      const { data: prof } = await supabaseAdmin.from('profiles').select('id').eq('email', String(b.email).toLowerCase()).maybeSingle();
      if (!prof) return NextResponse.json({ ok: false, error: 'cliente no encontrado' }, { status: 400 });
      const { assignClient } = await import('@/lib/sales');
      await assignClient((prof as any).id, b.rep_id, 'manual');
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
