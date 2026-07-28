import { NextResponse } from 'next/server';
import { getAdmin, requirePerm, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ensureDefaultCampaigns, campaignStats } from '@/lib/campaigns';
import { SEGMENTS } from '@/lib/segments';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · lista de campañas + segmentos disponibles + métricas 30d.
export async function GET() {
  const p = await requirePerm('campanas', 'view');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    await ensureDefaultCampaigns();
    const { data: campaigns } = await supabaseAdmin.from('campaigns').select('*').order('kind').order('created_at');
    const stats = await campaignStats();
    return NextResponse.json({ campaigns: campaigns || [], segments: SEGMENTS, stats });
  } catch (e: any) {
    await logError('campaigns_get', e);
    return NextResponse.json({ error: e?.message || 'error', campaigns: [], segments: SEGMENTS }, { status: 500 });
  }
}

// POST · crear una campaña manual (promo/noticia). Si trae scheduled_at (fecha
// futura), queda PROGRAMADA y activa: el cron la envía al llegar la hora.
export async function POST(req: Request) {
  const p = await requirePerm('campanas', 'manage');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    let schedIso: string | null = null;
    if (b.scheduled_at) {
      const d = new Date(b.scheduled_at);
      if (!isNaN(d.getTime())) schedIso = d.toISOString();
      if (schedIso && d.getTime() < Date.now() - 60000) return NextResponse.json({ error: 'La fecha de programación ya pasó.' }, { status: 400 });
    }
    const row = {
      name: String(b.name || 'Promo programada').slice(0, 120),
      kind: 'manual',
      segment: String(b.segment || 'all'),
      subject_es: String(b.subject_es || '').slice(0, 200),
      body_es: String(b.body_es || '').slice(0, 4000),
      subject_en: String(b.subject_en || '').slice(0, 200),
      body_en: String(b.body_en || '').slice(0, 4000),
      scheduled_at: schedIso,
      enabled: !!schedIso,   // programada => activa para que el cron la tome
    };
    const { data, error } = await supabaseAdmin.from('campaigns').insert(row).select('id').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAdmin(p.user?.email || '', schedIso ? 'campaign_schedule' : 'campaign_create', (data as any)?.id || '');
    return NextResponse.json({ ok: true, id: (data as any)?.id });
  } catch (e: any) {
    await logError('campaigns_post', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// PATCH · editar campaña (textos, segmento, disparador, on/off).
export async function PATCH(req: Request) {
  const p = await requirePerm('campanas', 'manage');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    if (!b.id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
    const patch: any = { updated_at: new Date().toISOString() };
    for (const k of ['name', 'segment', 'subject_es', 'body_es', 'subject_en', 'body_en', 'schedule']) {
      if (b[k] !== undefined) patch[k] = typeof b[k] === 'string' ? b[k].slice(0, 4000) : b[k];
    }
    if (b.enabled !== undefined) patch.enabled = !!b.enabled;
    if (b.scheduled_at !== undefined) {
      if (!b.scheduled_at) { patch.scheduled_at = null; }
      else { const d = new Date(b.scheduled_at); if (!isNaN(d.getTime())) { patch.scheduled_at = d.toISOString(); patch.enabled = true; } }
    }
    if (b.trigger && typeof b.trigger === 'object') {
      patch.trigger = { days: Math.max(0, Number(b.trigger.days) || 0), maxDays: Math.max(0, Number(b.trigger.maxDays) || 0) };
    }
    const { error } = await supabaseAdmin.from('campaigns').update(patch).eq('id', b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAdmin(p.user?.email || '', 'campaign_update', b.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await logError('campaigns_patch', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// DELETE · borrar una campaña (solo manuales; las automáticas tienen `key`).
export async function DELETE(req: Request) {
  const p = await requirePerm('campanas', 'manage');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    if (!b.id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
    const { data: c } = await supabaseAdmin.from('campaigns').select('key').eq('id', b.id).maybeSingle();
    if ((c as any)?.key) return NextResponse.json({ error: 'No se puede borrar una campaña del sistema. Apágala si no la quieres.' }, { status: 400 });
    await supabaseAdmin.from('campaigns').delete().eq('id', b.id);
    await logAdmin(p.user?.email || '', 'campaign_delete', b.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await logError('campaigns_delete', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
