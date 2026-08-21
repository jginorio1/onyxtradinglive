import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyStatement } from '@/lib/coachAI';
import { computeScoreForAccount } from '@/lib/copyScore';
import { pickLang } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST (multipart) · el trader sube su estado de cuenta del bróker para que Onyx AI
// verifique automáticamente que su cuenta es LIVE y coincide con la conectada.
// Si coincide (número de cuenta + es live) → marca verified=true y recalcula el
// tier (habilita Gold/Diamond). Si no, devuelve el motivo para que lo reintente.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado', code: 'no_auth' }, { status: 401 });

    const form = await req.formData();
    const file = form.get('file') as File | null;
    const accountId = String(form.get('account_id') || '').trim();
    const text = String(form.get('text') || '').trim();
    if (!accountId) return NextResponse.json({ error: 'falta la cuenta', code: 'missing_data' }, { status: 400 });
    if (!file && !text) return NextResponse.json({ error: 'sube el estado de cuenta', code: 'missing_data' }, { status: 400 });

    // La cuenta y el proveedor tienen que ser suyos.
    const { data: acc } = await supabaseAdmin.from('trading_accounts').select('id,login,broker').eq('id', accountId).eq('user_id', user.id).maybeSingle();
    if (!acc) return NextResponse.json({ error: 'cuenta no encontrada', code: 'not_found' }, { status: 404 });
    const { data: prov } = await supabaseAdmin.from('strategy_providers').select('id,verified').eq('account_id', accountId).maybeSingle();
    if (!prov) return NextResponse.json({ error: 'postula esta cuenta al ranking primero', code: 'no_provider' }, { status: 409 });

    // Leer el archivo (o texto) y pedirle a Onyx AI los datos de la cuenta.
    let input: any = { text };
    if (file) {
      if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'el archivo supera 8 MB', code: 'too_big' }, { status: 400 });
      const b64 = Buffer.from(await file.arrayBuffer()).toString('base64');
      input = { file: { media_type: file.type || 'image/png', data: b64 }, text: text || undefined };
    }
    const lang = pickLang(String(form.get('lang') || ''));
    const r = await verifyStatement(input, lang);
    if (!r.ok || !r.data) return NextResponse.json({ ok: false, verified: false, reason: r.reason || 'unreadable' });

    const d = r.data;
    const stmtDigits = String(d.login || '').replace(/\D/g, '');
    const accLogin = String((acc as any).login || '').replace(/\D/g, '');
    const loginMatch = !!accLogin && !!stmtDigits && stmtDigits === accLogin;
    const isLive = d.live === true;

    if (!isLive || !loginMatch) {
      const reason = !isLive ? 'not_live' : 'login_mismatch';
      return NextResponse.json({ ok: true, verified: false, reason, extracted: { login: d.login, broker: d.broker, live: d.live } });
    }

    // ¡Verificado! Marca la cuenta y recalcula el tier con verified=true.
    const res = await computeScoreForAccount(user.id, accountId, { verified: true });
    await supabaseAdmin.from('strategy_providers').update({
      verified: true, tier: res.tier, score: res.score, pillars: res.pillars, stats: res.stats, flags: res.flags,
      scored_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', (prov as any).id);

    return NextResponse.json({ ok: true, verified: true, tier: res.tier, score: res.score, extracted: { login: d.login, broker: d.broker } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
