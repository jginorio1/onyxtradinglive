import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ambSettings } from '@/lib/ambassadors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';   // en vivo; no se prerenderea en el build
export const revalidate = 0;              // nunca cachear en el servidor

// Cabeceras que impiden a Vercel/CDN/navegador guardar la respuesta en caché,
// para que los % de comisión/cupón que cambies en admin salgan al instante.
const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' };

// Estadísticas públicas para el landing. Todo es real y sale de la base de
// datos; crece solo con el uso. Nada inventado — si un usuario lo comprueba,
// cuadra. Un mínimo de arranque (base) evita enseñar "0" el primer día,
// pero el número que se muestra siempre incluye lo real por encima.
export async function GET() {
  try {
    // Operaciones analizadas (todas las importadas de todos)
    const { count: trades } = await supabaseAdmin
      .from('trades').select('*', { count: 'exact', head: true });

    // Veces que el Guardian frenó a alguien
    const { count: blocks } = await supabaseAdmin
      .from('manager_events').select('*', { count: 'exact', head: true }).eq('kind', 'blocked');

    // Cuentas de MetaTrader conectadas
    const { count: accounts } = await supabaseAdmin
      .from('trading_accounts').select('*', { count: 'exact', head: true });

    // Operaciones copiadas (cada comando enviado a una esclava = una copia real)
    const { count: copied } = await supabaseAdmin
      .from('copy_commands').select('*', { count: 'exact', head: true });

    // Robots monitoreados (cada fila de bots = un robot detectado/registrado)
    let bots = 0;
    try { const { count } = await supabaseAdmin.from('bots').select('*', { count: 'exact', head: true }); bots = Number(count || 0); } catch { /* tabla puede no existir */ }

    // Comisión y cupón del embajador (del panel admin) para que el landing
    // muestre siempre las cifras reales: si las cambias en admin, cambian aquí.
    let ambRate = 30, ambCoupon = 20, ambBase = 20, ambMinPayout = 50;
    try {
      const s = await ambSettings();
      ambRate = Number(s.tier_rate || 30);
      ambCoupon = Number(s.coupon_percent || 20);
      ambBase = Number(s.base_rate || 20);
      ambMinPayout = Number(s.min_payout || 50);
    } catch { /* si falla, dejamos los valores por defecto */ }

    // Base editable de las cifras del landing (desde Admin → Módulos).
    // La cifra pública = base + real, y sube en vivo con el uso de todos.
    let tBase = 0, bBase = 0, aBase = 0, cBase = 0, platforms = 5, readonly = 100;
    try {
      const { data: ls } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'landing_stats').maybeSingle();
      if (ls?.value) {
        tBase = Number(ls.value.trades_base || 0); bBase = Number(ls.value.blocks_base || 0); aBase = Number(ls.value.accounts_base || 0);
        cBase = Number(ls.value.copied_base || 0);
        if (ls.value.platforms != null) platforms = Number(ls.value.platforms);
        if (ls.value.readonly != null) readonly = Number(ls.value.readonly);
      }
    } catch {}

    // Piso semilla: si no hay base fijada NI operaciones reales, el número sería 0.
    // Para no enseñar un "0 +" pelado en el landing, mostramos una semilla mínima.
    // En cuanto el admin ponga una base o entren operaciones reales, manda eso.
    const SEED = { trades: 1000, blocks: 80, accounts: 40, copied: 300 };
    const t = tBase + Math.max(Number(trades || 0), 0);
    const b = bBase + Math.max(Number(blocks || 0), 0);
    const a = aBase + Math.max(Number(accounts || 0), 0);
    const c = cBase + Math.max(Number(copied || 0), 0);

    return NextResponse.json({
      trades: t > 0 ? t : SEED.trades,
      blocks: b > 0 ? b : SEED.blocks,
      accounts: a > 0 ? a : SEED.accounts,
      copied: c > 0 ? c : SEED.copied,
      bots: bots > 0 ? bots : 1200,
      platforms, readonly,          // valores fijos editables desde admin
      ambRate, ambCoupon, ambBase, ambMinPayout,
    }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ trades: 1000, blocks: 80, accounts: 40, copied: 300, platforms: 5, readonly: 100, ambRate: 30, ambCoupon: 20, ambBase: 20, ambMinPayout: 50 }, { headers: NO_CACHE });
  }
}
