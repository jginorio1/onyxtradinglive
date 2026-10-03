import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

// Redirección de enlace corto de marca: onyxtradinglive.com/r/<code> → URL real.
// Cuenta el clic (best-effort). Si el código no existe, va a la portada.
export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const code = String(params?.code || '').replace(/[^a-z0-9]/gi, '').slice(0, 32);
  if (!code) return NextResponse.redirect(SITE, 302);
  try {
    const { data } = await supabaseAdmin.from('short_links').select('url,clicks').eq('code', code).maybeSingle();
    const url = (data as any)?.url;
    if (!url) return NextResponse.redirect(SITE, 302);
    // Suma 1 al contador sin bloquear la redirección.
    supabaseAdmin.from('short_links')
      .update({ clicks: Number((data as any)?.clicks || 0) + 1, last_click_at: new Date().toISOString() })
      .eq('code', code).then(() => {}, () => {});
    return NextResponse.redirect(url, 302);
  } catch {
    return NextResponse.redirect(SITE, 302);
  }
}
