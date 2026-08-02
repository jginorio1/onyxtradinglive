import { pickLang, langFromCookie } from '@/lib/i18n';
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ambSettings } from '@/lib/ambassadors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// GET · banner social (SVG) con el código + cupón del embajador, para descargar.
export async function GET(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const { data: amb } = await supabaseAdmin.from('ambassadors').select('code,status').eq('user_id', user.id).maybeSingle();
  if (!amb || (amb as any).status !== 'approved') return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  const s = await ambSettings();
  const lang = pickLang(new URL(req.url).searchParams.get('lang'));
  const code = String((amb as any).code).toUpperCase();
  const pct = Number(s.coupon_percent || 20);
  const tagline = lang === 'en' ? 'Your MetaTrader trading journal + risk guard' : 'Tu diario de trading MetaTrader + guardián de riesgo';
  const cta = lang === 'en' ? `Use code ${code} · ${pct}% OFF` : `Usa el código ${code} · ${pct}% OFF`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0d1220"/>
  <rect x="0" y="0" width="1200" height="8" fill="#5b6cff"/>
  <circle cx="150" cy="150" r="46" fill="#121829" stroke="#5b6cff" stroke-width="3"/>
  <text x="150" y="166" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="#5b6cff" text-anchor="middle">O</text>
  <text x="225" y="165" font-family="Arial, sans-serif" font-size="40" font-weight="700" fill="#ffffff">Onyx Trading Live</text>
  <text x="150" y="300" font-family="Arial, sans-serif" font-size="34" fill="#aab2c8">${esc(tagline)}</text>
  <rect x="150" y="360" width="620" height="92" rx="14" fill="#5b6cff"/>
  <text x="460" y="418" font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="#0a0d14" text-anchor="middle">${esc(cta)}</text>
  <text x="150" y="540" font-family="Arial, sans-serif" font-size="26" fill="#7f8aa6">onyxtradinglive.com/?ref=${esc((amb as any).code)}</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'content-disposition': `attachment; filename="onyx-banner-${code}.svg"`,
    },
  });
}
