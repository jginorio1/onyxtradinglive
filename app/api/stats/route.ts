import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ambSettings } from '@/lib/ambassadors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';   // en vivo; no se prerenderea en el build

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

    return NextResponse.json({
      // El máximo entre lo real y una base pequeña de arranque.
      // No es inflar: es no enseñar un cero mientras el número real es bajo.
      trades: Math.max(Number(trades || 0), 0),
      blocks: Math.max(Number(blocks || 0), 0),
      accounts: Math.max(Number(accounts || 0), 0),
      ambRate, ambCoupon, ambBase, ambMinPayout,
    });
  } catch {
    return NextResponse.json({ trades: 0, blocks: 0, accounts: 0, ambRate: 30, ambCoupon: 20, ambBase: 20, ambMinPayout: 50 });
  }
}
