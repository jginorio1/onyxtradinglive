import { pickLang, langFromCookie } from '@/lib/i18n';
import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Respuestas guardadas (canned responses) que el equipo reutiliza al responder.

// Respuestas guardadas por defecto: las que un cliente suele necesitar. Se siembran
// una sola vez (si la tabla está vacía) y luego el equipo las edita o borra.
const SEED_CANNED: { title: string; body: string; lang: string }[] = [
  { lang: 'es', title: '👋 Saludo inicial', body: '¡Hola! Gracias por escribir a Onyx Trading Live. Soy del equipo de soporte y con gusto te ayudo. ¿Me cuentas un poco más de lo que necesitas?' },
  { lang: 'es', title: '🔑 Restablecer contraseña', body: 'Para restablecer tu contraseña, entra a la pantalla de inicio de sesión y toca “¿Olvidaste tu contraseña?”. Te llegará un correo con el enlace para crear una nueva. Si no lo ves, revisa la carpeta de spam.' },
  { lang: 'es', title: '💳 Problema con un depósito/pago', body: 'Lamento el inconveniente con tu pago. ¿Me compartes la fecha, el monto y el método que usaste? Con eso lo reviso de inmediato y te confirmo el estado.' },
  { lang: 'es', title: '🪪 Verificación de cuenta', body: 'Para verificar tu cuenta necesitamos una identificación oficial vigente y, en algunos casos, un comprobante de domicilio. En cuanto los recibamos, la verificación suele tardar menos de 24 horas.' },
  { lang: 'es', title: '⏳ Un momento, lo reviso', body: 'Permíteme un momento para revisar tu caso con detalle y te confirmo enseguida. Gracias por tu paciencia.' },
  { lang: 'en', title: '👋 First greeting', body: 'Hi! Thanks for reaching out to Onyx Trading Live. I’m from the support team and I’d be glad to help. Could you tell me a bit more about what you need?' },
  { lang: 'en', title: '🔑 Reset password', body: 'To reset your password, go to the sign-in screen and tap “Forgot your password?”. You’ll get an email with a link to set a new one. If you don’t see it, please check your spam folder.' },
  { lang: 'en', title: '💳 Payment/deposit issue', body: 'Sorry for the trouble with your payment. Could you share the date, amount and method you used? I’ll look into it right away and confirm the status.' },
  { lang: 'en', title: '🪪 Account verification', body: 'To verify your account we need a valid government ID and, in some cases, a proof of address. Once we receive them, verification usually takes less than 24 hours.' },
  { lang: 'en', title: '⏳ One moment, checking', body: 'Give me a moment to review your case in detail and I’ll get right back to you. Thanks for your patience.' },
];

// GET · lista de respuestas guardadas
export async function GET() {
  try {
    const { ok } = await requirePerm('soporte', 'view');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    let { data } = await supabaseAdmin
      .from('support_canned')
      .select('id,title,body,lang,created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    // Si nunca ha habido respuestas guardadas, sembramos un set útil por defecto.
    if (!data || data.length === 0) {
      try {
        await supabaseAdmin.from('support_canned').insert(SEED_CANNED.map((c) => ({ ...c, created_by: 'seed' })));
        const r = await supabaseAdmin.from('support_canned').select('id,title,body,lang,created_at').order('created_at', { ascending: false }).limit(100);
        data = r.data || [];
      } catch {}
    }
    return NextResponse.json({ canned: data || [] });
  } catch (e: any) {
    await logError('support_canned', e);
    return NextResponse.json({ canned: [] });
  }
}

// POST · crear una respuesta guardada
export async function POST(req: Request) {
  try {
    const g = await requirePerm('soporte', 'manage');
    if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const b = await req.json().catch(() => ({} as any));
    const title = String(b.title || '').trim().slice(0, 120);
    const body = String(b.body || '').trim().slice(0, 4000);
    const lang = pickLang(b.lang);
    if (!title || !body) return NextResponse.json({ error: 'faltan datos', code: 'missing' }, { status: 400 });
    const { data, error } = await supabaseAdmin
      .from('support_canned')
      .insert({ title, body, lang, created_by: g.user?.email || '' })
      .select('id').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAdmin(g.user?.email || '', 'canned_create', String(data?.id || ''), { title });
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e: any) {
    await logError('support_canned', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// DELETE · borrar una respuesta guardada
export async function DELETE(req: Request) {
  try {
    const g = await requirePerm('soporte', 'manage');
    if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const id = new URL(req.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'falta id', code: 'missing' }, { status: 400 });
    await supabaseAdmin.from('support_canned').delete().eq('id', id);
    await logAdmin(g.user?.email || '', 'canned_delete', id, {});
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await logError('support_canned', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
