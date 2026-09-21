import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const clean = (s: any, n = 300) => String(s || '').trim().slice(0, n);
const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

// POST público · una persona aplica para ser vendedor/supervisor desde la landing
// oculta. Guarda la solicitud (pendiente) y avisa al admin. Anti-spam básico.
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({} as any));
    const name = clean(b.name, 120);
    const email = clean(b.email, 160).toLowerCase();
    if (name.length < 2 || !isEmail(email)) return NextResponse.json({ ok: false, error: 'datos incompletos' }, { status: 400 });

    // Anti-duplicado: una solicitud pendiente por correo.
    const { data: prev } = await supabaseAdmin.from('sales_applications').select('id').eq('email', email).eq('status', 'pending').maybeSingle();
    if (prev) return NextResponse.json({ ok: true, duplicated: true });

    const role = ['vendedor', 'supervisor'].includes(clean(b.desired_role, 20)) ? clean(b.desired_role, 20) : 'vendedor';

    // Sponsor: supervisor que trajo al candidato con su enlace (?sponsor=CÓDIGO).
    let sponsorRepId: string | null = null;
    const sponsorCode = clean(b.sponsor, 40).toLowerCase();
    if (sponsorCode) {
      const { data: sp } = await supabaseAdmin.from('sales_reps').select('id,status').eq('code', sponsorCode).eq('status', 'active').maybeSingle();
      if (sp) sponsorRepId = (sp as any).id;
    }

    const { data: app } = await supabaseAdmin.from('sales_applications').insert({
      name, email,
      phone: clean(b.phone, 40) || null,
      country: clean(b.country, 60) || null,
      desired_role: role,
      experience: clean(b.experience, 800) || null,
      audience: clean(b.audience, 400) || null,
      note: clean(b.note, 1000) || null,
      resume_url: clean(b.resume_path, 300) || null,
      sponsor_rep_id: sponsorRepId,
      status: 'pending',
    }).select('id').maybeSingle();

    // Auto-aprobación en cascada (opcional): si el dueño lo activó y el candidato
    // llegó por un enlace de supervisor y ya tiene cuenta en la app, se cuelga solo
    // en la rama de ese supervisor. Si no, queda pendiente para tu revisión.
    let autoApproved = false;
    try {
      if (sponsorRepId) {
        const { salesSettings, uniqueRepCode } = await import('@/lib/sales');
        const s = await salesSettings();
        if (s.recruit_auto_approve === true) {
          const { data: prof } = await supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle();
          if (prof) {
            const uid = (prof as any).id;
            const { data: existsRep } = await supabaseAdmin.from('sales_reps').select('id').eq('user_id', uid).maybeSingle();
            if (!existsRep) {
              const code = await uniqueRepCode(email.split('@')[0] || 'sv');
              const { data: created } = await supabaseAdmin.from('sales_reps')
                .insert({ user_id: uid, level: 'vendedor', parent_id: sponsorRepId, code, status: 'active', display_name: name, approved_at: new Date().toISOString() })
                .select('id').maybeSingle();
              if (created) {
                await supabaseAdmin.from('sales_applications').update({ status: 'approved', rep_id: (created as any).id, reviewed_at: new Date().toISOString() }).eq('id', (app as any)?.id);
                autoApproved = true;
              }
            }
          }
        }
      }
    } catch { /* si algo falla, queda pendiente y lo apruebas tú */ }

    // Aviso al admin (email + Telegram si están disponibles). Silencioso si falla.
    try {
      const mail: any = await import('@/lib/mail');
      const mr: any = await import('@/lib/settings');
      const routes: any = (mr.mailRoutes ? await mr.mailRoutes().catch(() => ({})) : {}) || {};
      const to = String(routes.sales || routes.support || process.env.SUPPORT_EMAIL || 'support@onyxtradinglive.com').trim();
      await mail.sendEmail(to, `🧑‍💼 Nueva solicitud de vendedor · ${name}`,
        `Nombre: ${name}\nEmail: ${email}\nTeléfono: ${clean(b.phone, 40)}\nPaís: ${clean(b.country, 60)}\nRol deseado: ${role}\nExperiencia: ${clean(b.experience, 800)}\nAudiencia: ${clean(b.audience, 400)}\nMensaje: ${clean(b.note, 1000)}\n\nRevísala y apruébala en Admin → Ventas.`);
    } catch {}

    return NextResponse.json({ ok: true, autoApproved });
  } catch {
    return NextResponse.json({ ok: false, error: 'error' }, { status: 500 });
  }
}
