import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { repByUser, salesSettings, permsFor, subtreeRepIds } from '@/lib/sales';
import { complianceReport } from '@/lib/training';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · cumplimiento de formación del EQUIPO del supervisor (Lead/Director o quien
// pueda reclutar). Solo ve a los suyos (subárbol), nunca a toda la empresa.
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const rep = await repByUser(user.id);
  if (!rep) return NextResponse.json({ isRep: false });

  const s = await salesSettings();
  const perms = permsFor(rep, s);
  const canSeeTeam = rep.level !== 'vendedor' || perms.can_recruit;
  if (!canSeeTeam) return NextResponse.json({ canSeeTeam: false });

  // Subárbol de reps → sus user_ids (incluye al propio supervisor).
  const repIds = await subtreeRepIds(rep.id);
  let userIds: string[] = [];
  if (repIds.length) {
    const { data } = await supabaseAdmin.from('sales_reps').select('user_id').in('id', repIds);
    userIds = (data || []).map((r: any) => r.user_id).filter(Boolean);
  }
  const report = await complianceReport(userIds);
  return NextResponse.json({ canSeeTeam: true, report });
}
