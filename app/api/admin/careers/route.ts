import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { careersSettings, saveCareersSettings, allPositions, savePosition, deletePosition, listApplications } from '@/lib/careers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · plazas + postulaciones + ajustes.
export async function GET() {
  const { ok } = await requirePerm('equipo', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const settings = await careersSettings();
  const positions = await allPositions();
  const applications = await listApplications(300);
  const link = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '') + '/carreras';
  return NextResponse.json({ settings, positions, applications, link });
}

// POST · gestión.
export async function POST(req: Request) {
  const { ok, user } = await requirePerm('equipo', 'manage');
  if (!ok) return NextResponse.json({ error: 'Solo quien gestiona el equipo puede editar Carreras.' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const action = String(b.action || '');
  try {
    if (action === 'save_settings') { const s = await saveCareersSettings(b.settings || {}); return NextResponse.json({ ok: true, settings: s }); }
    if (action === 'save_position') { const r = await savePosition(b.position || {}); await logAdmin(user?.email || '', 'careers_save', r.id || '', {}); return NextResponse.json(r); }
    if (action === 'set_status' && b.id) { await supabaseAdmin.from('job_openings').update({ status: ['open', 'closed', 'draft'].includes(b.status) ? b.status : 'draft' }).eq('id', b.id); return NextResponse.json({ ok: true }); }
    if (action === 'delete_position' && b.id) { await deletePosition(b.id); return NextResponse.json({ ok: true }); }
    if (action === 'set_app_status' && b.app_id) { await supabaseAdmin.from('job_applications').update({ status: ['new', 'review', 'interview', 'hired', 'rejected'].includes(b.status) ? b.status : 'new' }).eq('id', b.app_id); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
