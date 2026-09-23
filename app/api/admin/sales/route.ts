import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { salesSettings, saveSalesSettings, uniqueRepCode, balances } from '@/lib/sales';
import { scoreboard, repScorecard, reviewsForTeam, evaluationsFor, actionsFor, submitEvaluation, logAction } from '@/lib/salesPerf';
import { goalProgress, goalFor } from '@/lib/salesGoals';
import { funnelStats, unassignedLeads, assignLeadsRoundRobin, autoPromoteAll } from '@/lib/salesGrowth';
import { listAssets, saveAsset, delAsset } from '@/lib/salesKit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LEVELS = ['vendedor', 'l1', 'l2'];

// GET · solicitudes + red (reps con saldos) + ajustes. Base del panel admin.
export async function GET() {
  const { ok } = await requirePerm('modulos', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const settings = await salesSettings();
  const { data: appsRaw } = await supabaseAdmin.from('sales_applications').select('*').order('created_at', { ascending: false }).limit(200);
  // Enlace firmado (1 h) para abrir el CV desde el panel (bucket privado).
  const apps: any[] = [];
  for (const a of (appsRaw || []) as any[]) {
    let cv = null;
    if (a.resume_url) { try { const { data: sig } = await supabaseAdmin.storage.from('sales-cv').createSignedUrl(a.resume_url, 3600); cv = (sig as any)?.signedUrl || null; } catch {} }
    // Nombre del supervisor que lo trajo (sponsor), para colgarlo en su rama.
    let sponsor_name = null;
    if (a.sponsor_rep_id) {
      try {
        const { data: sr } = await supabaseAdmin.from('sales_reps').select('display_name,user_id').eq('id', a.sponsor_rep_id).maybeSingle();
        sponsor_name = (sr as any)?.display_name || null;
        if (!sponsor_name && (sr as any)?.user_id) { const { data: sp } = await supabaseAdmin.from('profiles').select('email').eq('id', (sr as any).user_id).maybeSingle(); sponsor_name = (sp as any)?.email || null; }
      } catch {}
    }
    apps.push({ ...a, resume_signed: cv, sponsor_name });
  }
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

    // ---- PROPUESTA PARA VENDEDORES (PDF + email) ----
    // Usa los parámetros que manda el cliente (b.settings = ajustes en pantalla,
    // aunque no estén guardados) para que la propuesta salga con lo que ve el admin.
    if (action === 'proposal_pdf' || action === 'proposal_email') {
      const { proposalData, proposalPdf } = await import('@/lib/salesProposal');
      const s = b.settings && Object.keys(b.settings).length ? b.settings : await salesSettings();
      const data = proposalData(s, { price: Number(b.price) || 100, includeOverrides: b.include_overrides !== false, candidateName: b.name || '', clientsPerMonth: Number(b.clients_per_month) || 3 });
      const pdf = await proposalPdf(data, { company: 'Onyx Trading Live' });
      const base64 = Buffer.from(pdf).toString('base64');
      const filename = `propuesta-vendedor-onyx.pdf`;
      if (action === 'proposal_pdf') return NextResponse.json({ ok: true, pdf: base64, filename });
      // Enviar por correo con el PDF adjunto.
      const to = String(b.email || '').trim();
      if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return NextResponse.json({ error: 'Escribe un correo válido.', code: 'bad_email' }, { status: 400 });
      const { sendEmail, mailEnabled } = await import('@/lib/mail');
      if (!mailEnabled()) return NextResponse.json({ error: 'El correo no está configurado (falta RESEND_API_KEY).', code: 'no_mail' }, { status: 400 });
      const hi = b.name ? `Hola ${b.name},` : 'Hola,';
      const text = `${hi}\n\nTe comparto la propuesta para unirte como vendedor de Onyx Trading Live. Ganas un % alto el primer mes de cada cliente y comisión recurrente mientras siga pagando.\n\nEn el PDF adjunto verás los ejemplos con números. Si te interesa, postúlate en:\nhttps://www.onyxtradinglive.com/unete-ventas\n\n— Equipo de Onyx Trading Live`;
      const sent = await sendEmail(to, 'Propuesta para vendedores · Onyx Trading Live', text, { kind: 'sales_proposal', attachments: [{ filename, content: base64 }] });
      if (!sent) return NextResponse.json({ error: 'No se pudo enviar el correo.', code: 'send_fail' }, { status: 400 });
      return NextResponse.json({ ok: true, sent: true });
    }

    // ---- METAS Y BONOS ----
    // Progreso de metas del mes por cada rep (meta propia o global) + estado.
    if (action === 'goals') {
      const s = await salesSettings();
      const period = new Date().toISOString().slice(0, 7);
      const { data: reps } = await supabaseAdmin.from('sales_reps').select('id,level,display_name,user_id').eq('status', 'active');
      const rows: any[] = [];
      for (const r of (reps || []) as any[]) {
        const { data: prof } = await supabaseAdmin.from('profiles').select('email').eq('id', r.user_id).maybeSingle();
        const g = await goalFor(r.id, period, s);
        const p = await goalProgress(r.id, s);
        rows.push({ rep_id: r.id, level: r.level, name: r.display_name || (prof as any)?.email || 'Rep', goal: g, progress: p });
      }
      return NextResponse.json({ ok: true, period, rows });
    }
    // Fijar meta propia de un rep (anula la global para ese mes).
    if (action === 'set_goal' && b.rep_id) {
      const period = String(b.period || new Date().toISOString().slice(0, 7)).slice(0, 7);
      await supabaseAdmin.from('sales_goals').upsert({
        rep_id: b.rep_id, period,
        target_clients: Math.max(0, Number(b.target_clients) || 0),
        target_amount: Math.max(0, Number(b.target_amount) || 0),
        bonus_amount: Math.max(0, Number(b.bonus_amount) || 0),
      }, { onConflict: 'rep_id,period' });
      return NextResponse.json({ ok: true });
    }
    // Quitar meta propia (vuelve a heredar la global).
    if (action === 'del_goal' && b.rep_id) {
      const period = String(b.period || new Date().toISOString().slice(0, 7)).slice(0, 7);
      await supabaseAdmin.from('sales_goals').delete().eq('rep_id', b.rep_id).eq('period', period);
      return NextResponse.json({ ok: true });
    }

    // ---- CRECIMIENTO: embudo, leads sin dueño, ascensos ----
    if (action === 'funnel') { const f = await funnelStats(); return NextResponse.json({ ok: true, ...f }); }
    if (action === 'leads') { const leads = await unassignedLeads(100); return NextResponse.json({ ok: true, leads }); }
    if (action === 'assign_leads') { const r = await assignLeadsRoundRobin(300); return NextResponse.json({ ok: true, ...r }); }
    if (action === 'promote_now') { const r = await autoPromoteAll(); return NextResponse.json({ ok: true, ...r }); }

    // ---- KIT DE MATERIALES ----
    if (action === 'assets_list') { const assets = await listAssets('es', false); return NextResponse.json({ ok: true, assets }); }
    if (action === 'save_asset') { const r = await saveAsset(b.asset || {}); return NextResponse.json({ ok: true, ...r }); }
    if (action === 'del_asset' && b.id) { await delAsset(b.id); return NextResponse.json({ ok: true }); }

    // ---- DESEMPEÑO ----
    // Tablero de todo el equipo (o de una rama si se pasa root_rep_id).
    if (action === 'scoreboard') {
      const cards = await scoreboard(b.root_rep_id || null);
      return NextResponse.json({ ok: true, cards });
    }
    // Detalle de un rep: tarjeta + reseñas + evaluaciones + acciones + insight IA.
    if (action === 'rep_detail' && b.rep_id) {
      const s = await salesSettings();
      const { data: rep } = await supabaseAdmin.from('sales_reps').select('id,user_id,level,display_name').eq('id', b.rep_id).maybeSingle();
      const { data: prof } = rep ? await supabaseAdmin.from('profiles').select('email,name').eq('id', (rep as any).user_id).maybeSingle() : { data: null } as any;
      const card = await repScorecard(b.rep_id, s);
      const reviews = await (await import('@/lib/salesPerf')).reviewsForRep(b.rep_id, 60);
      const evals = await evaluationsFor(b.rep_id, 40);
      const actions = await actionsFor(b.rep_id, 30);
      const names = s.level_names;
      let insight: any = null;
      if (b.ai) {
        const { perfInsight } = await import('@/lib/salesAI');
        const roleName = (rep as any)?.level === 'l2' ? names.l2 : (rep as any)?.level === 'l1' ? names.l1 : names.vendedor;
        insight = await perfInsight(card, { name: (rep as any)?.display_name || (prof as any)?.email || 'Rep', role: roleName }, names, b.lang === 'en' ? 'en' : 'es');
      }
      return NextResponse.json({ ok: true, card, reviews, evals, actions, insight, email: (prof as any)?.email || null, name: (rep as any)?.display_name || (prof as any)?.name || null });
    }
    // Reseñas del equipo (feed).
    if (action === 'team_reviews') {
      const reviews = await reviewsForTeam(b.root_rep_id || null, 200);
      return NextResponse.json({ ok: true, reviews });
    }
    // Permisos por rep (override del nivel).
    if (action === 'set_perms' && b.rep_id) {
      await supabaseAdmin.from('sales_reps').update({ perms: b.perms || null }).eq('id', b.rep_id);
      return NextResponse.json({ ok: true });
    }
    // Guardar evaluación (admin evalúa a cualquiera).
    if (action === 'save_eval' && b.ratee_rep_id) {
      const r = await submitEvaluation({ raterRepId: null, rateeRepId: b.ratee_rep_id, direction: 'admin', scores: b.scores || {}, comment: b.comment, period: b.period });
      return NextResponse.json(r);
    }
    // Registrar acción del plan de manejo (promover/coaching/pausar/etc.).
    if (action === 'log_action' && b.rep_id) {
      await logAction({ repId: b.rep_id, kind: String(b.kind || 'note'), note: b.note, tier: b.tier });
      // Acciones que además cambian el estado del rep.
      if (b.kind === 'pause') await supabaseAdmin.from('sales_reps').update({ on_hold: true }).eq('id', b.rep_id);
      if (b.kind === 'resume') await supabaseAdmin.from('sales_reps').update({ on_hold: false }).eq('id', b.rep_id);
      if (b.kind === 'promote' && b.to_level) await supabaseAdmin.from('sales_reps').update({ level: b.to_level }).eq('id', b.rep_id);
      if (b.kind === 'demote' && b.to_level) await supabaseAdmin.from('sales_reps').update({ level: b.to_level }).eq('id', b.rep_id);
      return NextResponse.json({ ok: true });
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
      if (b.work_email !== undefined) patch.work_email = String(b.work_email || '').trim().slice(0, 160) || null;
      if (b.note !== undefined) patch.note = String(b.note || '').slice(0, 500) || null;
      await supabaseAdmin.from('sales_reps').update(patch).eq('id', b.rep_id);
      return NextResponse.json({ ok: true });
    }

    // Pagar a un rep por Stripe Connect (automático).
    if (action === 'pay_stripe' && b.rep_id) {
      const { paySalesRep } = await import('@/lib/salesPayout');
      const r = await paySalesRep(b.rep_id);
      return NextResponse.json(r);
    }
    // Marcar pago manual/USDT con referencia.
    if (action === 'pay_manual' && b.rep_id) {
      const { markSalesPaidManual } = await import('@/lib/salesPayout');
      const r = await markSalesPaidManual(b.rep_id, String(b.method || 'manual'), String(b.ref || ''));
      return NextResponse.json(r);
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
