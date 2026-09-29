import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { setIapPlan } from '@/lib/entitlements';
import { planRank } from '@/lib/planNotify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// ============================================================================
// CRON de reconciliaciÃ³n de planes de Apple (RevenueCat) â€” backstop semanal.
//
// AdemÃ¡s del webhook (tiempo real) y del /api/iap/refresh (al abrir la app), este
// cron recorre a los usuarios con compra de Apple y confirma su estado real contra
// RevenueCat. Cierra el Ãºltimo hueco: un usuario cuya suscripciÃ³n caducÃ³ pero que
// nunca vuelve a abrir la app se corrige igual (baja a su plan de Stripe o free).
//
// Protegido con CRON_SECRET. Programar en vercel.json (semanal recomendado).
// ============================================================================

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;                       // sin secreto configurado: no bloquea
  const q = new URL(req.url).searchParams.get('key') || '';
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}` || q === secret;
}

async function planFromProduct(productId: string, plans: any[]): Promise<string | null> {
  const pid = String(productId || '').toLowerCase();
  try {
    const raw = process.env.REVENUECAT_PRODUCT_MAP;
    if (raw) { const m = JSON.parse(raw); if (m[productId]) return String(m[productId]); if (m[pid]) return String(m[pid]); }
  } catch {}
  for (const p of plans) {
    const id = String(p.id || '').toLowerCase();
    if (id && id !== 'free' && pid.includes(id)) return p.id;
  }
  return null;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) return NextResponse.json({ ok: false, error: 'no_key' });

  // Solo usuarios con compra de Apple (activa o en gracia). Evita pegarle a RC por todos.
  const { data: users } = await supabaseAdmin.from('profiles')
    .select('id')
    .not('iap_plan', 'is', null)
    .limit(500);

  const rank = await planRank();
  const { data: plans } = await supabaseAdmin.from('plans').select('id').order('price_month', { ascending: false });
  const plansArr = (plans || []) as any[];

  let checked = 0, changed = 0, cleared = 0, errors = 0;
  for (const u of (users || []) as any[]) {
    try {
      const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(u.id)}`, {
        headers: { Authorization: `Bearer ${key}` }, cache: 'no-store',
        signal: (AbortSignal as any).timeout ? (H›ÜÚYÛ˜[\È[JK[Y[İ]
L
Hˆ[™Yš[™YˆJK˜Ø]Ú


HOˆ[
NÂˆYˆ
\ˆ\‹›ÚÊHÈ\œ›ÜœÊÊÎÈÛÛ[YNÈHËÈ[HYK›ÈØØ[[ÜÈH\İH\İX\š[ÂˆÛÛœİ]Nˆ[HH]ØZ]‹šœÛÛŠ
K˜Ø]Ú


HOˆ
ßJJNÂˆÛÛœİİXœÈH]OËœİXœØÜšX™\ËœİXœØÜš\[ÛœÈßNÂˆÛÛœİ›İÈH]K››İÊ
NÂˆ]™\İ[ˆİš[™È[H[™\İ›ÙXİH	ÉË™\İ^ˆİš[™È[H[™\İ˜[šÈHLNÂˆ›Üˆ
ÛÛœİÜY×HÙˆØš™Xİ™[šY\Ï[OŠİXœÊJHÂˆÛÛœİ^\ÈHÏË™^\™\×Ù]HÈ]Kœ\œÙJË™^\™\×Ù]JHˆÂˆYˆ
Y^\È^\ÈH›İÊHÛÛ[YNÂˆÛÛœİ[ˆH]ØZ][‘œ›ÛT›ÙXİ
Y[œĞ\œŠNÂˆYˆ
\[ŠHÛÛ[YNÂˆÛÛœİšÈH˜[šÖÜ[—HOH[È˜[šÖÜ[—HˆLNÂˆYˆ
šÈˆ™\İ˜[šÊHÈ™\İ˜[šÈHšÎÈ™\İ[ˆH[È™\İ›ÙXİHYÈ™\İ^H™]È]J^\ÊKÒTÓÔİš[™Ê
NÈBˆBˆÚXÚÙY
ÊÎÂˆYˆ
™\İ[ŠHÈ]ØZ]Ù]X\[ŠKšYÈ[ˆ™\İ[‹›ÙXİˆ™\İ›ÙXİİ]\Îˆ	ØXİ]™IË^\™\Ğ]ˆ™\İ^JNÈÚ[™ÙY
ÊÎÈBˆ[ÙHÈ]ØZ]Ù]X\[ŠKšYÈ[ˆ[İ]\Îˆ	Ù^\™Y	ÈJNÈÛX\™Y
ÊÎÈBˆHØ]ÚÈ\œ›ÜœÊÊÎÈBˆB‚ˆ™]\›ˆ™^™\ÜÛœÙKšœÛÛŠÈÚÎˆYKİ[ˆ
\Ù\œÈ×JK›[™İÚXÚÙYÚ[™ÙYÛX\™Y\œ›ÜœÈJNÂŸB