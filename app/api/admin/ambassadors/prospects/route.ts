import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSetting, saveSetting, ambassadorOutreachSettings, type AmbassadorOutreach } from '@/lib/settings';
import { runAmbassadorOutreach } from '@/lib/ambassadorOutreach';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const STATUSES = ['new', 'contacted', 'replied', 'joined', 'passed'];
const clampInt = (v: any, lo: number, hi: number, fb: number) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fb; };

// Parseo simple de CSV/pegado: columnas nombre,plataforma,nicho,email,handle (con o sin cabecera).
function parseProspects(text: string): any[] {
  const rows: any[] = [];
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 2000)) {
    const cols = line.split(/[,;\t]/).map((c) => c.trim());
    if (/^(nombre|name)$/i.test(cols[0])) continue; // salta cabecera
    const name = cols[0]; if (!name) continue;
    const email = cols.find((c) => /@/.test(c)) || (cols[3] || '');
    rows.push({
      name: name.slice(0, 120),
      platform: (cols[1] || 'youtube').slice(0, 30),
      niche: (cols[2] || 'prop').slice(0, 30),
      email: email ? email.slice(0, 160) : null,
      handle: (cols[4] || (email ? '' : cols[3]) || '').slice(0, 200) || null,
      status: 'new',
    });
  }
  return rows;
}

// GET · pipeline de prospectos + ajustes del auto-reclutamiento
export async function GET() {
  const p = await requirePerm('embajadores', 'view');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const { data } = await supabaseAdmin.from('ambassador_prospects').select('*').order('created_at', { ascending: false }).limit(500);
    const outreach = await ambassadorOutreachSettings();
    return NextResponse.json({ prospects: data || [], outreach });
  } catch (e: any) {
    await logError('amb_prospects_get', e);
    return NextResponse.json({ prospects: [], outreach: await ambassadorOutreachSettings().catch(() => null) });
  }
}

// POST · añadir prospecto
export async function POST(req: Request) {
  const p = await requirePerm('embajadores', 'manage');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));

    // Guardar ajustes del auto-reclutamiento.
    if (b.action === 'settings') {
      const prev = await getSetting<AmbassadorOutreach>('ambassador_outreach', await ambassadorOutreachSettings());
      const value: AmbassadorOutreach = {
        enabled: b.enabled == null ? prev.enabled : !!b.enabled,
        followupDays: b.followupDays == null ? prev.followupDays : clampInt(b.followupDays, 1, 60, prev.followupDays),
        maxFollowups: b.maxFollowups == null ? prev.maxFollowups : clampInt(b.maxFollowups, 0, 5, prev.maxFollowups),
        perRun: b.perRun == null ? prev.perRun : clampInt(b.perRun, 1, 200, prev.perRun),
      };
      await saveSetting('ambassador_outreach', value);
      return NextResponse.json({ ok: true, outreach: value });
    }

    // Importar muchos de golpe (CSV/pegado).
    if (b.action === 'import') {
      const rows = parseProspects(b.text || '');
      if (!rows.length) return NextResponse.json({ error: 'No se detectaron prospectos válidos.' }, { status: 400 });
      const { error } = await supabaseAdmin.from('ambassador_prospects').insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await logAdmin(p.user?.email || '', 'ambassador_prospects_import', String(rows.length));
      return NextResponse.json({ ok: true, imported: rows.length });
    }

    // Probar ahora el auto-reclutamiento (fuerza una corrida).
    if (b.action === 'run') {
      const r = await runAmbassadorOutreach(true);
      return NextResponse.json({ ok: true, ...r });
    }

    if (!String(b.name || '').trim()) return NextResponse.json({ error: 'Falta el nombre.' }, { status: 400 });
    const row = {
      name: String(b.name).slice(0, 120),
      platform: String(b.platform || 'youtube'),
      niche: String(b.niche || 'prop'),
      handle: b.handle ? String(b.handle).slice(0, 200) : null,
      email: b.email ? String(b.email).slice(0, 160) : null,
      note: b.note ? String(b.note).slice(0, 500) : null,
      status: 'new',
    };
    const { data, error } = await supabaseAdmin.from('ambassador_prospects').insert(row).select('id').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAdmin(p.user?.email || '', 'ambassador_prospect_add', (data as any)?.id || '');
    return NextResponse.json({ ok: true, id: (data as any)?.id });
  } catch (e: any) {
    await logError('amb_prospects_post', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// PATCH · mover de estado / editar
export async function PATCH(req: Request) {
  const p = await requirePerm('embajadores', 'manage');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    if (!b.id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
    const patch: any = { updated_at: new Date().toISOString() };
    if (b.status && STATUSES.includes(b.status)) patch.status = b.status;
    if (b.note !== undefined) patch.note = String(b.note || '').slice(0, 500);
    for (const k of ['name', 'platform', 'niche', 'handle', 'email']) if (b[k] !== undefined) patch[k] = b[k] ? String(b[k]).slice(0, 200) : null;
    const { error } = await supabaseAdmin.from('ambassador_prospects').update(patch).eq('id', b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await logError('amb_prospects_patch', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// DELETE · quitar prospecto
export async function DELETE(req: Request) {
  const p = await requirePerm('embajadores', 'manage');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    if (!b.id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
    await supabaseAdmin.from('ambassador_prospects').delete().eq('id', b.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await logError('amb_prospects_del', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
