import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { allScholarships } from '@/lib/academyScholarship';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · vista global de Onyx (solo lectura): todas las becas de todas las
// academias, con nombre de academia y correo del alumno. Para supervisión.
export async function GET() {
  const { ok } = await requirePerm('ajustes', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const list = await allScholarships(500);
  const mentorIds = Array.from(new Set(list.map((s: any) => s.mentor_id).filter(Boolean)));
  const studentIds = Array.from(new Set(list.map((s: any) => s.student_id).filter(Boolean)));

  const academyBy: Record<string, string> = {};
  if (mentorIds.length) {
    const { data } = await supabaseAdmin.from('mentors').select('user_id,academy_name').in('user_id', mentorIds);
    for (const m of (data || []) as any[]) academyBy[m.user_id] = m.academy_name || m.user_id;
  }
  const emailBy: Record<string, string> = {};
  if (studentIds.length) {
    const { data } = await supabaseAdmin.from('profiles').select('id,email').in('id', studentIds);
    for (const p of (data || []) as any[]) emailBy[p.id] = p.email;
  }

  const now = Date.now();
  const rows = list.map((s: any) => ({
    id: s.id, academy: academyBy[s.mentor_id] || '—', mentor_id: s.mentor_id,
    who: s.kind === 'code' ? s.code : (emailBy[s.student_id] || '—'),
    kind: s.kind, coverage: s.coverage, scope: s.scope, reason: s.reason,
    ends_at: s.ends_at, status: s.status,
    live: s.status === 'active' && (!s.ends_at || new Date(s.ends_at).getTime() > now),
  }));
  const summary = {
    total: rows.length,
    active: rows.filter((r) => r.live).length,
    academies: mentorIds.length,
    byReason: rows.reduce((a: Record<string, number>, r) => { a[r.reason] = (a[r.reason] || 0) + 1; return a; }, {}),
  };
  return NextResponse.json({ rows, summary });
}
