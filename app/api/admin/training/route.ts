import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import {
  trainingSettings, saveTrainingSettings, listTracksAdmin, trackFull,
  saveTrack, delTrack, saveLesson, delLesson, saveQuestion, delQuestion,
  roster, setAccess, enrollByEmail, autoEnrollSync,
} from '@/lib/training';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · panel admin: ajustes + rutas + roster.
export async function GET() {
  const { ok } = await requirePerm('equipo', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const [settings, tracks, people] = await Promise.all([trainingSettings(), listTracksAdmin(), roster()]);
  return NextResponse.json({ settings, tracks, roster: people });
}

// POST · todas las acciones de gestión.
export async function POST(req: Request) {
  const { ok, user } = await requirePerm('equipo', 'edit');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  const email = user?.email || 'admin';

  try {
    switch (action) {
      case 'save_settings': {
        const s = await saveTrainingSettings(body.settings || {});
        await logAdmin(email, 'training_settings', 'training', {});
        return NextResponse.json({ ok: true, settings: s });
      }
      case 'track_full': {
        const d = await trackFull(String(body.id));
        return NextResponse.json({ ok: true, ...(d || {}) });
      }
      case 'save_track': {
        const r = await saveTrack(body.track || {});
        await logAdmin(email, 'training_save_track', r.id || '', {});
        return NextResponse.json(r);
      }
      case 'del_track': { await delTrack(String(body.id)); return NextResponse.json({ ok: true }); }
      case 'save_lesson': return NextResponse.json(await saveLesson(body.lesson || {}));
      case 'del_lesson': { await delLesson(String(body.id)); return NextResponse.json({ ok: true }); }
      case 'save_question': return NextResponse.json(await saveQuestion(body.question || {}));
      case 'del_question': { await delQuestion(String(body.id)); return NextResponse.json({ ok: true }); }
      case 'set_access': {
        await setAccess(String(body.user_id), { active: body.active, role: body.role }, user?.id);
        await logAdmin(email, 'training_access', String(body.user_id), { active: body.active, role: body.role });
        return NextResponse.json({ ok: true });
      }
      case 'enroll_email': return NextResponse.json(await enrollByEmail(String(body.email || ''), String(body.role || 'staff'), user?.id));
      case 'auto_enroll': {
        const r = await autoEnrollSync();
        await logAdmin(email, 'training_auto_enroll', '', r);
        return NextResponse.json({ ok: true, ...r });
      }
      case 'roster': return NextResponse.json({ ok: true, roster: await roster() });
      default: return NextResponse.json({ error: 'acción desconocida' }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
