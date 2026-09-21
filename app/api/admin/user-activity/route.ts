import { NextResponse } from 'next/server';
import { getAdmin, logAdmin, requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/mail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · ficha de un usuario: quién cambió qué + correos que le envió el sistema
export async function GET(req: Request) {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const p = await requirePerm('usuarios', 'view'); if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const id = new URL(req.url).searchParams.get('id') || '';
  const { data: prof } = await supabaseAdmin.from('profiles').select('email,plan').eq('id', id).maybeSingle();
  const email = (prof as any)?.email || '';

  const { data: activity } = await supabaseAdmin.from('admin_log')
    .select('admin_email,action,meta,created_at').eq('target', id).order('created_at', { ascending: false }).limit(60);

  let emails: any[] = [];
  if (email) {
    const r = await supabaseAdmin.from('email_log').select('subject,kind,status,created_at').eq('to_email', email).order('created_at', { ascending: false }).limit(60);
    emails = r.data || [];
  }

  return NextResponse.json({ email, plan: (prof as any)?.plan || null, activity: activity || [], emails });
}

// POST · escribirle un correo al usuario (se envía por Resend y queda registrado)
export async function POST(req: Request) {
  const a = await getAdmin();
  if (!a.isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const p = await requirePerm('usuarios', 'manage'); if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const b = await req.json().catch(() => ({} as any));
  const id = String(b.id || '');
  const subject = String(b.subject || '').trim().slice(0, 200);
  const body = String(b.body || '').trim().slice(0, 8000);
  if (!subject || !body) return NextResponse.json({ error: 'faltan datos', code: 'missing' }, { status: 400 });

  const { data: prof } = await supabaseAdmin.from('profiles').select('email').eq('id', id).maybeSingle();
  const email = (prof as any)?.email;
  if (!email) return NextResponse.json({ error: 'usuario sin correo', code: 'invalid' }, { status: 400 });

  const ok = await sendEmail(email, subject, body, { kind: 'admin', userId: id });
  if (!ok) return NextResponse.json({ error: 'No se pudo enviar (revisa RESEND_API_KEY).', code: 'mail' }, { status: 500 });

  await logAdmin(a.user?.email || '', 'email_user', id, { subject });
  return NextResponse.json({ ok: true });
}
