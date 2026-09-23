import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Comunidad de PRUEBA "Onyx Live" para grabar el video de App Review.
//
// Crea un mentor de prueba ("Onyx Team"), unos miembros con posts, comentarios
// y likes (en inglés), y DEJA INSCRITA la cuenta demo como MIEMBRO normal — así
// en el video se ven los botones de Reportar y Bloquear (que solo aparecen sobre
// contenido de otros usuarios, no para el mentor).
//
// Uso (protegido por CRON_SECRET, igual que /api/push/diag):
//   Crear/repoblar:  GET /api/admin/seed-demo-community?secret=XXXX
//   Repoblar limpio: GET /api/admin/seed-demo-community?secret=XXXX&reset=1
//   Borrar todo:     GET /api/admin/seed-demo-community?secret=XXXX&delete=1
//
// Todo son datos de prueba: se borran con &delete=1 cuando termines el video.
// ============================================================

const DEMO_EMAIL = 'jerrytrader35@gmail.com'; // la cuenta que le das a Apple
const MENTOR = { email: 'onyx.team@onyxdemo.dev', name: 'Onyx Team', country: 'US' };
const MEMBERS = [
  { email: 'carlos.mendez@onyxdemo.dev', name: 'Carlos Mendez', country: 'MX', points: 480 },
  { email: 'ana.torres@onyxdemo.dev', name: 'Ana Torres', country: 'CO', points: 260 },
  { email: 'luis.fernandez@onyxdemo.dev', name: 'Luis Fernandez', country: 'ES', points: 150 },
  { email: 'sofia.ramirez@onyxdemo.dev', name: 'Sofia Ramirez', country: 'AR', points: 320 },
  { email: 'diego.herrera@onyxdemo.dev', name: 'Diego Herrera', country: 'PE', points: 90 },
];
const ALL_SEED_EMAILS = [MENTOR.email, ...MEMBERS.map((m) => m.email)];

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();

async function findUserByEmail(email: string) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    const users = (data as any)?.users || [];
    const u = users.find((x: any) => (x.email || '').toLowerCase() === target);
    if (u) return u;
    if (users.length < 200) break;
  }
  return null;
}

async function ensureUser(email: string, name: string, country: string) {
  let u: any = await findUserByEmail(email);
  if (!u) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email, email_confirm: true, password: 'Onyx!' + randomUUID(),
      user_metadata: { full_name: name },
    });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
    u = (data as any).user;
  }
  // El trigger de Supabase suele crear el profile; con upsert nos aseguramos del nombre y país.
  await supabaseAdmin.from('profiles').upsert(
    { id: u.id, email, full_name: name, country },
    { onConflict: 'id' },
  );
  return u.id as string;
}

async function GETimpl(req: Request) {
  const sp = new URL(req.url).searchParams;
  const secret = sp.get('secret') || '';
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const mentorId = await ensureUser(MENTOR.email, MENTOR.name, MENTOR.country);
  const wantDelete = sp.get('delete') === '1';
  const wantReset = sp.get('reset') === '1' || wantDelete;

  // Limpieza (para reset o borrado): quita todo lo de esta academia de prueba.
  if (wantReset) {
    const { data: oldPosts } = await supabaseAdmin.from('academy_posts').select('id').eq('mentor_id', mentorId);
    const pids = (oldPosts || []).map((p: any) => p.id);
    await supabaseAdmin.from('academy_likes').delete().eq('mentor_id', mentorId);
    if (pids.length) await supabaseAdmin.from('academy_comments').delete().in('post_id', pids);
    await supabaseAdmin.from('academy_posts').delete().eq('mentor_id', mentorId);
    await supabaseAdmin.from('academy_enrollments').delete().eq('mentor_id', mentorId);
    await supabaseAdmin.from('academy_points').delete().eq('mentor_id', mentorId);
  }

  if (wantDelete) {
    await supabaseAdmin.from('mentors').delete().eq('user_id', mentorId);
    // Borra los usuarios de prueba (arrastra sus perfiles). La cuenta demo NO se toca.
    for (const email of ALL_SEED_EMAILS) {
      const u = await findUserByEmail(email);
      if (u) { try { await supabaseAdmin.auth.admin.deleteUser(u.id); } catch {} }
    }
    return NextResponse.json({ ok: true, deleted: true });
  }

  // Mentor / academia "Onyx Live".
  await supabaseAdmin.from('mentors').upsert({
    user_id: mentorId, code: 'onyxlive', academy_name: 'Onyx Live',
    tagline: 'Real traders, real results', about: 'A community to share trades, ask questions and celebrate wins.',
    active: true, subs_open: true, assistant_on: false,
  }, { onConflict: 'user_id' });

  // Crea los miembros y reúne sus ids.
  const memberIds: Record<string, string> = {};
  for (const m of MEMBERS) memberIds[m.email] = await ensureUser(m.email, m.name, m.country);
  const [carlos, ana, luis, sofia, diego] = MEMBERS.map((m) => memberIds[m.email]);

  // La cuenta demo (Apple) entra como MIEMBRO normal.
  const demo = await findUserByEmail(DEMO_EMAIL);
  const demoId = demo?.id || null;

  // Inscribe a todos (miembros + demo) en la academia.
  const enrollees = [...Object.values(memberIds), ...(demoId ? [demoId] : [])];
  for (const sid of enrollees) {
    await supabaseAdmin.from('academy_enrollments').upsert(
      { mentor_id: mentorId, student_id: sid, status: 'active' },
      { onConflict: 'mentor_id,student_id' },
    );
  }
  // Puntos (para que se vean niveles).
  for (const m of MEMBERS) {
    await supabaseAdmin.from('academy_points').upsert(
      { mentor_id: mentorId, user_id: memberIds[m.email], points: m.points },
      { onConflict: 'mentor_id,user_id' },
    );
  }

  // --- Publicaciones (en inglés) ---
  async function post(author: string, body: string, opts: any = {}) {
    const row: any = {
      mentor_id: mentorId, author_id: author, body, status: 'visible',
      kind: opts.kind || 'community', win_kind: opts.win_kind || null,
      announcement: !!opts.announcement, pinned: !!opts.pinned,
      image_url: opts.image_url || null, created_at: opts.at || hoursAgo(1),
    };
    const { data, error } = await supabaseAdmin.from('academy_posts').insert(row).select('id').single();
    if (error) throw new Error('post: ' + error.message);
    return (data as any).id as string;
  }
  async function comment(postId: string, author: string, body: string, at: string) {
    await supabaseAdmin.from('academy_comments').insert({ post_id: postId, author_id: author, body, status: 'visible', created_at: at });
  }
  async function like(type: 'post' | 'comment', id: string, users: string[]) {
    for (const u of users) {
      await supabaseAdmin.from('academy_likes').upsert(
        { mentor_id: mentorId, target_type: type, target_id: id, user_id: u },
        { onConflict: 'mentor_id,target_type,target_id,user_id' },
      );
    }
  }

  const pAnn = await post(mentorId, 'Welcome to Onyx Live! Share your trades, questions and wins here. Be respectful — no spam and no get-rich-quick promises. Break the rules and your post gets removed.', { announcement: true, pinned: true, at: hoursAgo(48) });
  const pCarlos = await post(carlos, 'Closed the week +3.2% on XAUUSD sticking to my plan. Patience pays.', { at: hoursAgo(6) });
  const pAna = await post(ana, 'EURUSD view for today: range 1.0850–1.0920. Waiting for a clean break before entering, no chasing.', { kind: 'analysis', at: hoursAgo(9) });
  const pLuis = await post(luis, 'Anyone using the Guardian on funded accounts? What daily loss limit do you set?', { kind: 'question', at: hoursAgo(20) });
  const pSofia = await post(sofia, 'First payout from my funded account! $1,240. Thank you to everyone in this community.', { kind: 'win', win_kind: 'payout', at: hoursAgo(30) });
  const pDiego = await post(diego, '12-day check-in streak. Journaling every trade really changed my results.', { kind: 'habits', at: hoursAgo(40) });

  await comment(pCarlos, ana, 'Nice one! What timeframe did you use for the entry?', hoursAgo(5));
  await comment(pCarlos, diego, 'Congrats, keep it up.', hoursAgo(4));
  await comment(pCarlos, carlos, 'Thanks! H1 for bias, M5 for the entry.', hoursAgo(3));
  await comment(pLuis, carlos, 'I keep it at 3% daily, never more.', hoursAgo(18));
  await comment(pLuis, mentorId, 'Great question — start conservative and scale later.', hoursAgo(16));
  await comment(pSofia, ana, 'So happy for you!', hoursAgo(28));
  await comment(pSofia, luis, 'Goals. Well deserved.', hoursAgo(27));

  await like('post', pAnn, [carlos, ana, luis, sofia, diego]);
  await like('post', pCarlos, [ana, diego, luis, sofia]);
  await like('post', pAna, [carlos, luis]);
  await like('post', pLuis, [diego, sofia]);
  await like('post', pSofia, [carlos, ana, luis, diego, mentorId]);
  await like('post', pDiego, [ana, carlos]);

  return NextResponse.json({
    ok: true,
    academy: 'Onyx Live', code: 'onyxlive',
    mentor: MENTOR.email, members: MEMBERS.length,
    demo_enrolled: !!demoId,
    demo_note: demoId ? 'La cuenta demo ya está inscrita como miembro.' : 'OJO: no encontré la cuenta demo por email; entra una vez con ella y vuelve a correr esto.',
    posts: 6, comments: 7,
  });
}

export async function GET(req: Request) {
  try { return await GETimpl(req); }
  catch (e: any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}
