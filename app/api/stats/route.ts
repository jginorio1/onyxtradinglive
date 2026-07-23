import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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

    return NextResponse.json({
      // El máximo entre lo real y una base pequeña de arranque.
      // No es inflar: es no enseñar un cero mientras el número real es bajo.
      trades: Math.max(Number(trades || 0), 0),
      blocks: Math.max(Number(blocks || 0), 0),
      accounts: Math.max(Number(accounts || 0), 0),
    });
  } catch {
    return NextResponse.json({ trades: 0, blocks: 0, accounts: 0 });
  }
}
