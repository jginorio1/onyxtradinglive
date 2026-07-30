import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getMentor, myAcademies, getContent, progressSet, markLesson, isEnrolled, listPosts, addPost, addComment, leaderboard, membersList, toggleLike, levelFor, listEvents, nextEvent, dmUnread, tradersBoard } from '@/lib/academy';
import { listProducts, accessibleModules, studentPurchases, perksFor, membershipInfo, hasMembership } from '@/lib/academyPay';
import { myReferralStats } from '@/lib/academyExtras';
import { auditAddon, hasAuditAddon, auditConsent, planVerified } from '@/lib/academyAudit';

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
  const out: any = { canMentor: !!caps?.academy, isMentor: !!mentorRow, mentorCode: mentorRow?.code || null, myMentorId: mentorRow?.user_id || null, myAcademyName: mentorRow?.academy_name || null, academies: mine };
  const enrolledHere = m ? await isEnrolled(m, user.id) : false;
  const iAmMentorHere = m && mentorRow && mentorRow.user_id === m;
  // Comunidad de pago: si no es el mentor y no tiene membresía activa → paywall.
  if (m && (enrolledHere || iAmMentorHere) && !iAmMentorHere) {
    const info = await membershipInfo(m);
    if (info.paid && !(await hasMembership(user.id, m))) {
      const { data: mrow } = await supabaseAdmin.from('mentors').select('academy_name,tagline,code,cover_url').eq('user_id', m).maybeSingle();
      out.membershipRequired = { mentor_id: m, ...(mrow as any), priceCents: info.priceCents, currency: info.currency, interval: info.interval };
      return NextResponse.json(out);
    }
  }
  if (m && (enrolledHere || iAmMentorHere)) {
    const [mentor, content, progress, feed, products, access, purchases, board, members, myPts, roster, events, live, unread] = await Promise.all([
      supabaseAdmin.from('mentors').select('academy_name,tagline,about,cover_url,logo_url,socials,code').eq('user_id', m).maybeSingle(),
      getContent(m, true), progressSet(user.id, m), listPosts(m, user.id), listProducts(m, true), accessibleModules(user.id, m), studentPurchases(user.id, m),
      leaderboard(m, 'all', 10), membersList(m),
      supabaseAdmin.from('academy_points').select('points').eq('mentor_id', m).eq('user_id', user.id).maybeSingle(),
      supabaseAdmin.from('academy_enrollments').select('student_id', { count: 'exact', head: true }).eq('mentor_id', m).eq('status', 'active'),
      listEvents(m), nextEvent(m), dmUnread(m, user.id),
    ]);
    const myPerks = iAmMentorHere ? { copy: true, guardian: true } : await perksFor(user.id, m);
    const [refStats, mrow2, addon, hasAddon, consent, verified] = await Promise.all([
      myReferralStats(user.id, m),
      supabaseAdmin.from('mentors').select('affiliate_reward_cents,affiliate_currency').eq('user_id', m).maybeSingle(),
      auditAddon(m),
      iAmMentorHere ? Promise.resolve(false) : hasAuditAddon(user.id, m),
      iAmMentorHere ? Promise.resolve(false) : auditConsent(m, user.id),
      iAmMentorHere ? Promise.resolve(false) : planVerified(m, user.id),
    ]);
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
    };
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
      const mentorRow = await getMentor(user.id);
      const allowed = (mentorRow && mentorRow.user_id === b.mentor_id) || (await isEnrolled(String(b.mentor_id), user.id));
      if (!allowed) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
      await addPost(String(b.mentor_id), user.id, String(b.body), false, b.image_url ? String(b.image_url) : undefined);
      return NextResponse.json({ ok: true });
    }
    if (b.action === 'comment' && b.post_id && b.mentor_id && (b.body || b.image_url)) {
      const mentorRow = await getMentor(user.id);
      const allowed = (mentorRow && mentorRow.user_id === b.mentor_id) || (await isEnrolled(String(b.mentor_id), user.id));
      if (!allowed) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
      await addComment(String(b.post_id), user.id, String(b.body), b.image_url ? String(b.image_url) : undefined);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  } catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}
