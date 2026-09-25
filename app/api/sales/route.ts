import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { repByUser, repById, salesSettings, balances, listClients, teamRollup, grantTrial, permsFor, subtreeRepIds } from '@/lib/sales';
import { repStatement, goalProgress } from '@/lib/salesGoals';
import { listAssets, notesForClient, addNote, setNoteDone, pendingFollowups, signContract, saveTax, saveRepProfile } from '@/lib/salesKit';
import { repScorecard, scoreboard, reviewsForRep, reviewsForTeam, evaluationsFor, submitEvaluation, logAction, SCORE_WEIGHTS, SCORE_FACTORS, perfTips, snapshotAndHistory } from '@/lib/salesPerf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://www.onyxtradinglive.com';

// GET · panel del vendedor/supervisor (todo lo suyo).
export async function GET() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const rep = await repByUser(user.id);
  if (!rep) return NextResponse.json({ isRep: false });

  const s = await salesSettings();
  const bal = await balances(rep.id);
  const clients = await listClients(rep.id);
  const team = rep.level !== 'vendedor' ? await teamRollup(rep.id) : [];

  // Tickets abiertos de MIS clientes (para que los atienda).
  const clientIds = clients.map((c) => c.user_id);
  let tickets: any[] = [];
  if (clientIds.length) {
    const { data } = await supabaseAdmin.from('support_tickets')
      .select('id,user_id,subject,category,status,updated_at').in('user_id', clientIds)
      .neq('status', 'closed').order('updated_at', { ascending: false }).limit(50);
    tickets = (data || []).map((t: any) => ({ ...t, client: (clients.find((c) => c.user_id === t.user_id) || {}).email }));
  }

  // Método de cobro + estado Connect.
  let connect = { connected: false, payoutsEnabled: false };
  try { const { salesConnectStatus } = await import('@/lib/salesPayout'); connect = await salesConnectStatus(rep.id); } catch {}
  const { data: prof } = await supabaseAdmin.from('profiles').select('payout_usdt_trc20,payout_usdt_erc20,payout_usdt_network').eq('id', user.id).maybeSingle();
  const { data: payouts } = await supabaseAdmin.from('sales_payouts').select('amount,method,status,ref,paid_at,created_at').eq('rep_id', rep.id).order('created_at', { ascending: false }).limit(30);

  const link = `${appUrl()}/?sv=${rep.code}`;
  const caps = { trial_max_days: s.trial_max_days, discount_max_pct: s.discount_max_pct, min_payout: s.min_payout, hold_days: s.hold_days };

  // Desempeño propio + mis reseñas (para que se vea a sí mismo y mejore).
  const perms = permsFor(rep as any, s);
  const myCard = await repScorecard(rep.id, s);
  // Historial mensual (guarda la foto de este mes + trae los meses anteriores) y
  // sugerencias EN VIVO de qué mejorar, según los factores más flojos.
  const scoreHistory = await snapshotAndHistory(rep.id, myCard as any, 6);
  const scoreTips = perfTips((myCard as any).parts || {});
  const myReviews = await reviewsForRep(rep.id, 40);
  const statement = await repStatement(rep.id, 200);   // extracto línea por línea
  const goal = await goalProgress(rep.id, s);            // progreso de la meta del mes
  const [kitEs, kitEn] = await Promise.all([listAssets('es', true), listAssets('en', true)]);
  const kitMap: Record<string, any> = {}; [...kitEs, ...kitEn].forEach((a: any) => { kitMap[a.id] = a; });
  const kit = Object.values(kitMap);                    // materiales de venta
  const followups = await pendingFollowups(rep.id);     // seguimientos pendientes

  // Supervisores: tablero de su equipo + reseñas del equipo + a quién puede evaluar.
  let teamBoard: any[] = [], teamReviews: any[] = [], evalTargets: any[] = [];
  if (rep.level !== 'vendedor') {
    teamBoard = await scoreboard(rep.id);
    teamReviews = await reviewsForTeam(rep.id, 120);
    const ids = await subtreeRepIds(rep.id);
    if (ids.length) {
      const { data: subs } = await supabaseAdmin.from('sales_reps').select('id,user_id,level,display_name').in('id', ids);
      for (const r of (subs || []) as any[]) {
        const { data: p } = await supabaseAdmin.from('profiles').select('email').eq('id', r.user_id).maybeSingle();
        evalTargets.push({ id: r.id, level: r.level, name: r.display_name || (p as any)?.email || 'Rep' });
      }
    }
  }
  // A mi supervisor lo puedo evaluar (evaluación hacia arriba).
  let mySupervisor: any = null;
  if (rep.parent_id) {
    const sup = await repById(rep.parent_id);
    if (sup) { const { data: p } = await supabaseAdmin.from('profiles').select('email').eq('id', sup.user_id).maybeSingle(); mySupervisor = { id: sup.id, level: sup.level, name: sup.display_name || (p as any)?.email || 'Supervisor' }; }
  }

  return NextResponse.json({
    isRep: true,
    rep: { id: rep.id, level: rep.level, code: rep.code, display_name: rep.display_name, from_name: rep.from_name, reply_to: rep.reply_to, payout_method: (rep as any).payout_method || 'stripe', on_hold: rep.on_hold, status: rep.status, contract_signed_at: (rep as any).contract_signed_at || null, contract_name: (rep as any).contract_name || null, tax_form_type: (rep as any).tax_form_type || null, tax_data: (rep as any).tax_data || {}, bio: (rep as any).bio || '', photo_url: (rep as any).photo_url || '' },
    link, balances: bal, caps, clients, team, tickets, connect,
    perms, scorecard: myCard, myReviews, teamBoard, teamReviews, evalTargets, mySupervisor, statement, goal, kit, followups,
    // Explicación de la evaluación + tendencia + sugerencias para el vendedor.
    scoreExplain: { weights: SCORE_WEIGHTS, factors: SCORE_FACTORS, thresholds: s.tier_thresholds || { star: 75, risk: 45 } },
    scoreHistory, scoreTips,
    eval_criteria: s.eval_criteria || [],
    level_names: s.level_names || { l2: 'Director', l1: 'Lead', vendedor: 'Advisor' },
    wallets: { trc20: (prof as any)?.payout_usdt_trc20 || '', erc20: (prof as any)?.payout_usdt_erc20 || '', network: (prof as any)?.payout_usdt_network || 'trc20' },
    payouts: payouts || [],
    activeClients: clients.filter((c) => c.active).length,
  });
}

// POST · acciones del vendedor.
export async function POST(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const rep = await repByUser(user.id);
  if (!rep || rep.status !== 'active') return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const action = String(b.action || '');

  try {
    // Dar prueba a un cliente propio (tope de días).
    if (action === 'grant_trial') {
      const r = await grantTrial(rep.id, String(b.client_user_id || ''), Number(b.days) || 0);
      return NextResponse.json(r);
    }

    // Dar descuento: genera un código de cupón para compartir (tope %).
    if (action === 'grant_discount') {
      const s = await salesSettings();
      // Candado anti-abuso: tope de cupones por vendedor en 24h (0 = ilimitado).
      const dCap = Number(s.discount_daily_cap) || 0;
      if (dCap > 0) {
        const since = new Date(Date.now() - 86400000).toISOString();
        const { count } = await supabaseAdmin.from('sales_grants').select('*', { count: 'exact', head: true }).eq('rep_id', rep.id).eq('kind', 'discount').gte('created_at', since);
        if ((count || 0) >= dCap) return NextResponse.json({ ok: false, error: `Llegaste al límite de ${dCap} cupones en 24 horas.` }, { status: 429 });
      }
      const pct = Math.max(1, Math.min(Number(b.pct) || 0, s.discount_max_pct || 20));
      const { stripe } = await import('@/lib/stripe');
      const coupon = await stripe.coupons.create({ percent_off: pct, duration: 'once', name: `Onyx ${pct}% · ${rep.code}` });
      const codeStr = `${rep.code}${pct}`.toUpperCase().slice(0, 20);
      const promo = await stripe.promotionCodes.create({ coupon: coupon.id, code: codeStr, max_redemptions: Number(b.max) > 0 ? Number(b.max) : undefined });
      await supabaseAdmin.from('sales_grants').insert({ rep_id: rep.id, kind: 'discount', value: pct, code: promo.code });
      return NextResponse.json({ ok: true, code: promo.code, pct });
    }

    // Guardar método de cobro y datos de marca (from/reply-to).
    if (action === 'save_payout') {
      const patch: any = {};
      if (['stripe', 'usdt'].includes(b.payout_method)) patch.payout_method = b.payout_method;
      if (b.from_name !== undefined) patch.from_name = String(b.from_name || '').slice(0, 80) || null;
      if (b.reply_to !== undefined) patch.reply_to = String(b.reply_to || '').slice(0, 160) || null;
      if (b.work_email !== undefined) patch.work_email = String(b.work_email || '').trim().slice(0, 160) || null;
      await supabaseAdmin.from('sales_reps').update(patch).eq('id', rep.id);
      // Billetera USDT (se guarda en el perfil, validada).
      if (b.payout_method === 'usdt' && b.wallet && b.network) {
        const { validateWallet } = await import('@/lib/payoutProfile');
        const net = b.network === 'erc20' ? 'erc20' : 'trc20';
        const v = validateWallet(net, String(b.wallet));
        if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
        const col = net === 'erc20' ? 'payout_usdt_erc20' : 'payout_usdt_trc20';
        await supabaseAdmin.from('profiles').update({ [col]: String(b.wallet).trim(), payout_usdt_network: net }).eq('id', user.id);
      }
      return NextResponse.json({ ok: true });
    }

    // Enlace de Stripe Connect para conectar el cobro automático.
    if (action === 'connect_link') {
      const { salesOnboardingLink } = await import('@/lib/salesPayout');
      const url = await salesOnboardingLink(rep.id, user.id, user.email || undefined);
      return NextResponse.json({ ok: true, url });
    }

    // Responder un ticket de un cliente propio.
    if (action === 'reply_ticket') {
      const ticketId = String(b.ticket_id || '');
      const body = String(b.body || '').trim().slice(0, 4000);
      if (!ticketId || !body) return NextResponse.json({ ok: false, error: 'faltan datos' }, { status: 400 });
      const { data: t } = await supabaseAdmin.from('support_tickets').select('user_id,email,subject').eq('id', ticketId).maybeSingle();
      if (!t) return NextResponse.json({ ok: false, error: 'ticket no existe' }, { status: 404 });
      const { data: own } = await supabaseAdmin.from('sales_clients').select('id').eq('rep_id', rep.id).eq('user_id', (t as any).user_id).maybeSingle();
      if (!own) return NextResponse.json({ ok: false, error: 'no es tu cliente' }, { status: 403 });
      await supabaseAdmin.from('support_messages').insert({ ticket_id: ticketId, sender: 'agent', sender_id: user.id, body });
      await supabaseAdmin.from('support_tickets').update({ status: 'answered', updated_at: new Date().toISOString() }).eq('id', ticketId);
      // Correo al cliente con el remitente del vendedor (buzón de tu dominio si lo
      // tiene; reply-to a su correo). Silencioso si falla.
      try {
        const clientEmail = (t as any).email;
        if (clientEmail) {
          const senderName = rep.from_name || rep.display_name || 'Tu asesor Onyx';
          const workEmail = (rep as any).work_email || null;
          const replyTo = workEmail || rep.reply_to || undefined;
          const { sendEmail, fromWithAddr } = await import('@/lib/mail');
          await sendEmail(clientEmail, `Re: ${(t as any).subject || 'Tu consulta en Onyx'}`,
            `${body}\n\n—\n${senderName} · Onyx Trading Live\nResponde a este correo o entra a tu Centro de soporte para seguir la conversación.`,
            { from: fromWithAddr(senderName, workEmail), replyTo });
        }
        const { emitNotif } = await import('@/lib/emitNotif');
        await emitNotif((t as any).user_id, 'support_reply', { vars: { body: `${(t as any).subject ? (t as any).subject + ': ' : ''}${body.slice(0, 90)}` }, url: `/dashboard/soporte?ticket=${ticketId}` }).catch(() => {});
      } catch {}
      return NextResponse.json({ ok: true });
    }

    // Insight de IA sobre mi propio desempeño (o de un miembro de mi equipo).
    if (action === 'insight') {
      const s = await salesSettings();
      let targetId = rep.id, targetLevel = rep.level, targetName = rep.display_name || 'Rep';
      if (b.rep_id && b.rep_id !== rep.id && rep.level !== 'vendedor') {
        const ids = await subtreeRepIds(rep.id);
        if (!ids.includes(b.rep_id)) return NextResponse.json({ ok: false, error: 'no es de tu equipo' }, { status: 403 });
        const t = await repById(b.rep_id); if (t) { targetId = t.id; targetLevel = t.level; targetName = t.display_name || 'Rep'; }
      }
      const card = await repScorecard(targetId, s);
      const { perfInsight } = await import('@/lib/salesAI');
      const names = s.level_names;
      const roleName = targetLevel === 'l2' ? names.l2 : targetLevel === 'l1' ? names.l1 : names.vendedor;
      const insight = await perfInsight(card, { name: targetName, role: roleName }, names, b.lang === 'en' ? 'en' : 'es');
      return NextResponse.json({ ok: true, card, insight });
    }

    // Evaluación: hacia mi supervisor (rep_to_sup) o a un miembro de mi equipo (sup_to_rep).
    if (action === 'submit_eval' && b.ratee_rep_id) {
      let direction = '';
      if (rep.parent_id && b.ratee_rep_id === rep.parent_id) direction = 'rep_to_sup';
      else if (rep.level !== 'vendedor') {
        const ids = await subtreeRepIds(rep.id);
        if (ids.includes(b.ratee_rep_id)) direction = 'sup_to_rep';
      }
      if (!direction) return NextResponse.json({ ok: false, error: 'no puedes evaluar a esta persona' }, { status: 403 });
      const r = await submitEvaluation({ raterRepId: rep.id, rateeRepId: b.ratee_rep_id, direction, scores: b.scores || {}, comment: b.comment, period: b.period });
      return NextResponse.json(r);
    }

    // Coaching/nota de un supervisor a un miembro de su equipo (bitácora).
    if (action === 'coach' && b.rep_id && rep.level !== 'vendedor') {
      const ids = await subtreeRepIds(rep.id);
      if (!ids.includes(b.rep_id)) return NextResponse.json({ ok: false, error: 'no es de tu equipo' }, { status: 403 });
      await logAction({ repId: b.rep_id, kind: String(b.kind || 'coach'), note: b.note, by: user.id });
      return NextResponse.json({ ok: true });
    }

    // ---- MINI-CRM: notas y seguimiento por cliente ----
    if (action === 'client_notes' && b.client_user_id) {
      const own = await supabaseAdmin.from('sales_clients').select('id').eq('rep_id', rep.id).eq('user_id', b.client_user_id).maybeSingle();
      if (!own.data) return NextResponse.json({ ok: false, error: 'no es tu cliente' }, { status: 403 });
      return NextResponse.json({ ok: true, notes: await notesForClient(rep.id, b.client_user_id) });
    }
    if (action === 'add_note' && b.client_user_id && (b.note || b.followup_at)) {
      const own = await supabaseAdmin.from('sales_clients').select('id').eq('rep_id', rep.id).eq('user_id', b.client_user_id).maybeSingle();
      if (!own.data) return NextResponse.json({ ok: false, error: 'no es tu cliente' }, { status: 403 });
      await addNote(rep.id, b.client_user_id, String(b.note || ''), b.followup_at || null);
      return NextResponse.json({ ok: true });
    }
    if (action === 'note_done' && b.note_id) { await setNoteDone(rep.id, b.note_id, b.done !== false); return NextResponse.json({ ok: true }); }

    // ---- Contrato, fiscal y perfil público ----
    if (action === 'sign_contract') { const r = await signContract(rep.id, b.name); return NextResponse.json(r); }
    if (action === 'save_tax') { await saveTax(rep.id, String(b.form_type || 'other'), b.tax_data || {}); return NextResponse.json({ ok: true }); }
    if (action === 'save_profile') { await saveRepProfile(rep.id, { bio: b.bio, photo_url: b.photo_url }); return NextResponse.json({ ok: true }); }

    return NextResponse.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
