import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getMentor, myAcademies, getContent, progressSet, markLesson, isEnrolled, listPosts, addPost, addComment, leaderboard, membersList, toggleLike, levelFor, listEvents, nextEvent, dmUnread, tradersBoard, recentCount, deleteOwnPost, deleteOwnComment, editOwnPost, editOwnComment } from '@/lib/academy';
import { listProducts, accessibleModules, studentPurchases, perksFor, membershipInfo, hasMembership } from '@/lib/academyPay';
import { myReferralStats } from '@/lib/academyExtras';
import { auditAddon, hasAuditAddon, auditConsent, planVerified } from '@/lib/academyAudit';
import { listWins, pendingCount, addWin, myPending } from '@/lib/academyWins';
import { pushWinPending } from '@/lib/academyPush';
import { roleMap, permsFor, staffIds } from '@/lib/academyCollab';
import { getSettings, moderateText, isMuted, pendingContentCount, reportsCount, escalateOnBlock } from '@/lib/academyModeration';

// Mensaje que ve el alumno cuando su texto se bloquea (sin exponer qué palabra).
function blockedMsg(category: string): string {
  if (category === 'spam') return 'Tu mensaje parece spam o promoción no permitida y no se publicó.';
  return 'Tu mensaje no cumple las normas de la comunidad y no se publicó.';
}
// ¿Es un miembro "nuevo" (para el modo de revisión de primeros posts)? Nuevo si aún
// tiene menos de `threshold` publicaciones o entró hace menos de 3 días.
async function isNewMember(mentorId: string, userId: string, threshold: number): Promise<boolean> {
  if (threshold <= 0) return false;
  const { data } = await supabaseAdmin.from('academy_enrollments').select('posts_count,joined_at').eq('mentor_id', mentorId).eq('student_id', userId).maybeSingle();
  const pc = (data as any)?.posts_count || 0;
  const joined = (data as any)?.joined_at ? new Date((data as any).joined_at).getTime() : 0;
  const recent = joined && (Date.now() - joined) < 3 * 24 * 3600 * 1000;
  return pc < threshold || recent;
}

// ¿Puede este usuario ESCRIBIR en esta academia? (inscrito + membresía si es de pago).
async function canWrite(userId: string, mentorId: string, isMentorHere: boolean): Promise<boolean> {
  if (isMentorHere) return true;
  if (!(await isEnrolled(mentorId, userId))) return false;
  const info = await membershipInfo(mentorId);
  if (info.paid && !(await hasMembership(userId, mentorId))) return false;
  return true;
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { user: null as any, caps: {} as any };
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', (prof as any)?.plan || 'free').maybeSingle();
  return { user, caps: (plan?.capabilities as any) || {} };
}

// GET · vista del alumno. ?m=mentorId abre esa academia (contenido + progreso + comunidad).
export async function GET(req: Request) {
  const { user, caps } = await me();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const m = sp.get('m');
  const boardRange = sp.get('board');
  // Petición ligera solo del ranking (para el selector 7d/30d/all-time/traders).
  if (m && boardRange) {
    const mrow = await getMentor(user.id);
    const allowed = (mrow && mrow.user_id === m) || (await isEnrolled(m, user.id));
    if (!allowed) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    if (boardRange === 'traders') return NextResponse.json({ traders: await tradersBoard(m, 50) });
    const range = boardRange === '7d' ? '7d' : boardRange === '30d' ? '30d' : 'all';
    return NextResponse.json({ leaderboard: await leaderboard(m, range, 50) });
  }
  const [mine, mentorRow] = await Promise.all([myAcademies(user.id), getMentor(user.id)]);
  const out: any = { canMentor: !!caps?.academy, isMentor: !!mentorRow, mentorCode: mentorRow?.code || null, myMentorId: mentorRow?.user_id || null, myAcademyName: mentorRow?.academy_name || null, myLogoUrl: mentorRow?.logo_url || null, academies: mine };
  const enrolledHere = m ? await isEnrolled(m, user.id) : false;
  const iAmMentorHere = m && mentorRow && mentorRow.user_id === m;
  // Comunidad de pago: si no es el mentor y no tiene membresía activa → paywall.
  if (m && (enrolledHere || iAmMentorHere) && !iAmMentorHere) {
    const info = await membershipInfo(m);
    if (info.paid && !(await hasMembership(user.id, m))) {
      const { data: mrow } = await supabaseAdmin.from('mentors').select('academy_name,tagline,code,cover_url').eq('user_id', m).maybeSingle();
      out.membershipRequired = { mentor_id: m, ...(mrow as any), priceCents: info.priceCents, yearCents: info.yearCents, yearSavePct: info.yearSavePct, currency: info.currency, interval: info.interval };
      return NextResponse.json(out);
    }
  }
  if (m && (enrolledHere || iAmMentorHere)) {
    const [mentor, content, progress, feed, products, access, purchases, board, members, myPts, roster, events, live, unread] = await Promise.all([
      supabaseAdmin.from('mentors').select('academy_name,tagline,about,cover_url,logo_url,socials,code,assistant_on').eq('user_id', m).maybeSingle(),
      getContent(m, true), progressSet(user.id, m), listPosts(m, user.id, false, !!iAmMentorHere), listProducts(m, true), accessibleModules(user.id, m), studentPurchases(user.id, m),
      leaderboard(m, 'all', 10), membersList(m),
      supabaseAdmin.from('academy_points').select('points').eq('mentor_id', m).eq('user_id', user.id).maybeSingle(),
      supabaseAdmin.from('academy_enrollments').select('student_id', { count: 'exact', head: true }).eq('mentor_id', m).eq('status', 'active'),
      listEvents(m), nextEvent(m), dmUnread(m, user.id),
    ]);
    const myPerks = iAmMentorHere ? { copy: true, guardian: true } : await perksFor(user.id, m);
    // Marca "en línea" (para el puntito verde de miembros).
    supabaseAdmin.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id).then(() => {});
    const [refStats, mrow2, addon, hasAddon, consent, verified, wins, winsPending] = await Promise.all([
      myReferralStats(user.id, m),
      supabaseAdmin.from('mentors').select('affiliate_reward_cents,affiliate_currency').eq('user_id', m).maybeSingle(),
      auditAddon(m),
      iAmMentorHere ? Promise.resolve(false) : hasAuditAddon(user.id, m),
      iAmMentorHere ? Promise.resolve(false) : auditConsent(m, user.id),
      iAmMentorHere ? Promise.resolve(false) : planVerified(m, user.id),
      listWins(m, user.id),
      iAmMentorHere ? pendingCount(m) : Promise.resolve(0),
    ]);
    const [roles, myPerms, staff, prefsRow] = await Promise.all([roleMap(m), permsFor(m, user.id), staffIds(m), supabaseAdmin.from('profiles').select('academy_push_prefs').eq('id', user.id).maybeSingle()]);
    const myPushPrefs = (prefsRow.data as any)?.academy_push_prefs || {};
    // Un módulo se bloquea SOLO si la academia vende niveles y el alumno no tiene
    // acceso. Si no hay niveles activos, es una academia gratis → todo abierto.
    // El mentor siempre ve todo desbloqueado.
    const gated = (products as any[]).filter((p: any) => p.kind !== 'audit').length > 0;
    const lockedContent = (content as any[]).map((mod: any) => {
      const unlocked = iAmMentorHere || !gated || access.all || access.ids.has(mod.id);
      return { ...mod, locked: !unlocked, lessons: mod.lessons.map((l: any) => (unlocked || l.is_free) ? l : { id: l.id, title: l.title, is_free: false, locked: true }) };
    });
    const myPoints = (myPts.data as any)?.points || 0;
    out.active = {
      mentor_id: m, ...(mentor.data as any), content: lockedContent, progress, feed, products, purchases,
      hasAccess: iAmMentorHere || access.all || access.ids.size > 0, hasAccessAll: iAmMentorHere || access.all,
      isMentorHere: !!iAmMentorHere,
      leaderboard: board, members, membersCount: (roster as any).count || members.length,
      me: { points: myPoints, level: levelFor(myPoints).level },
      events, live, dmUnread: unread, myUserId: user.id, myPerks,
      referral: refStats, affiliateReward: (mrow2.data as any)?.affiliate_reward_cents || 0, affiliateCurrency: (mrow2.data as any)?.affiliate_currency || 'usd',
      audit: { addon, hasAddon, consent, verified },
      wins, winsPending,
      roles, myPerms, staffIds: staff, myPushPrefs,
    };
    // Un colaborador con permiso de moderar también ve la cola por aprobar.
    if (!iAmMentorHere && (myPerms as any)?.moderate) out.active.winsPending = await pendingCount(m);
    // El alumno ve sus propios logros pendientes (zona "esperando aprobación").
    if (!iAmMentorHere) out.active.winsMinePending = await myPending(m, user.id);
    // Moderación: el equipo (dueño o colaborador que modera) ve contadores de cola.
    const canModerate = iAmMentorHere || (myPerms as any)?.moderate;
    if (canModerate) {
      const [pc, rc, ms] = await Promise.all([pendingContentCount(m), reportsCount(m), getSettings(m)]);
      out.active.modPending = pc; out.active.modReports = rc; out.active.modLevel = ms.level;
    }
  }
  return NextResponse.json(out);
}

// POST · progreso de lección, o publicar en comunidad / comentar.
export async function POST(req: Request) {
  const { user } = await me();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === 'lesson' && b.lesson_id) { await markLesson(user.id, String(b.lesson_id), !!b.done); return NextResponse.json({ ok: true }); }
    if (b.action === 'like' && b.mentor_id && b.target_id && (b.target_type === 'post' || b.target_type === 'comment')) {
      const mentorRow2 = await getMentor(user.id);
      const allowed = (mentorRow2 && mentorRow2.user_id === b.mentor_id) || (await isEnrolled(String(b.mentor_id), user.id));
      if (!allowed) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
      const r = await toggleLike(user.id, String(b.mentor_id), b.target_type, String(b.target_id));
      return NextResponse.json({ ok: true, ...r });
    }
    if (b.action === 'post' && b.mentor_id && (b.body || b.image_url)) {
      const mid = String(b.mentor_id);
      const mentorRow = await getMentor(user.id);
      const isMentorHere = !!(mentorRow && mentorRow.user_id === mid);
      if (!(await canWrite(user.id, mid, isMentorHere))) return NextResponse.json({ error: 'needs_membership' }, { status: 403 });
      if (!isMentorHere) {
        const mu = await isMuted(mid, user.id);
        if (mu.muted) return NextResponse.json({ error: 'muted', until: mu.until }, { status: 403 });
      }
      if (await recentCount('academy_posts', 'author_id', user.id, 60) >= 8) return NextResponse.json({ error: 'too_fast' }, { status: 429 });
      // Un LOGRO de un alumno NO se publica directo: pasa a la cola de aprobación de la academia.
      if (b.kind === 'win' && !isMentorHere) {
        await addWin(mid, user.id, { kind: b.win_kind || 'payout', title: b.body, image_url: b.image_url });
        pushWinPending(mid, user.id);
        return NextResponse.json({ ok: true, pending: true });
      }
      // Moderación del texto (el mentor no se auto-modera).
      let modStatus: string | undefined; let flag: string | undefined;
      if (!isMentorHere && b.body) {
        const settings = await getSettings(mid);
        const isNew = await isNewMember(mid, user.id, settings.new_member_review);
        const dec = await moderateText(settings, String(b.body), { kind: 'post', isNewMember: isNew });
        if (dec.action === 'block') { const esc = await escalateOnBlock(mid, user.id, settings, dec.reason); return NextResponse.json({ error: 'blocked', category: dec.category, message: blockedMsg(dec.category), escalated: esc.action }, { status: 422 }); }
        if (dec.action === 'review') { modStatus = 'pending'; flag = dec.reason; }
      }
      await addPost(mid, user.id, String(b.body), false, b.image_url ? String(b.image_url) : undefined, undefined, { kind: b.kind, win_kind: b.win_kind, status: modStatus, flag_reason: flag });
      return NextResponse.json({ ok: true, pending: modStatus === 'pending' });
    }
    if (b.action === 'comment' && b.post_id && b.mentor_id && (b.body || b.image_url)) {
      const mid = String(b.mentor_id);
      const mentorRow = await getMentor(user.id);
      const isMentorHere = !!(mentorRow && mentorRow.user_id === mid);
      if (!(await canWrite(user.id, mid, isMentorHere))) return NextResponse.json({ error: 'needs_membership' }, { status: 403 });
      if (!isMentorHere) {
        const mu = await isMuted(mid, user.id);
        if (mu.muted) return NextResponse.json({ error: 'muted', until: mu.until }, { status: 403 });
      }
      if (await recentCount('academy_comments', 'author_id', user.id, 60) >= 15) return NextResponse.json({ error: 'too_fast' }, { status: 429 });
      let modStatus: string | undefined; let flag: string | undefined;
      if (!isMentorHere && b.body) {
        const settings = await getSettings(mid);
        const dec = await moderateText(settings, String(b.body), { kind: 'comment' });
        if (dec.action === 'block') { const esc = await escalateOnBlock(mid, user.id, settings, dec.reason); return NextResponse.json({ error: 'blocked', category: dec.category, message: blockedMsg(dec.category), escalated: esc.action }, { status: 422 }); }
        if (dec.action === 'review') { modStatus = 'pending'; flag = dec.reason; }
      }
      await addComment(String(b.post_id), user.id, String(b.body), b.image_url ? String(b.image_url) : undefined, { status: modStatus, flag_reason: flag });
      return NextResponse.json({ ok: true, pending: modStatus === 'pending' });
    }
    // El alumno borra lo SUYO (verifica autor en la consulta).
    if (b.action === 'delete_post' && b.id) { return NextResponse.json(await deleteOwnPost(user.id, String(b.id))); }
    if (b.action === 'delete_comment' && b.id) { return NextResponse.json(await deleteOwnComment(user.id, String(b.id))); }
    // El alumno edita el texto de lo SUYO. Si edita, se vuelve a moderar.
    if ((b.action === 'edit_post' || b.action === 'edit_comment') && b.id && b.mentor_id && b.body != null) {
      const mid = String(b.mentor_id);
      const mentorRow = await getMentor(user.id);
      const isMentorHere = !!(mentorRow && mentorRow.user_id === mid);
      let modStatus: string | undefined; let flag: string | undefined;
      if (!isMentorHere) {
        const dec = await moderateText(await getSettings(mid), String(b.body), { kind: b.action === 'edit_post' ? 'post' : 'comment' });
        if (dec.action === 'block') { const esc = await escalateOnBlock(mid, user.id, await getSettings(mid), dec.reason); return NextResponse.json({ error: 'blocked', message: blockedMsg(dec.category), escalated: esc.action }, { status: 422 }); }
        modStatus = dec.action === 'review' ? 'pending' : 'visible'; if (dec.action === 'review') flag = dec.reason;
      } else { modStatus = 'visible'; }
      const r = b.action === 'edit_post'
        ? await editOwnPost(user.id, String(b.id), String(b.body), modStatus, flag)
        : await editOwnComment(user.id, String(b.id), String(b.body), modStatus, flag);
      return NextResponse.json({ ...r, pending: modStatus === 'pending' });
    }
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  } catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}
