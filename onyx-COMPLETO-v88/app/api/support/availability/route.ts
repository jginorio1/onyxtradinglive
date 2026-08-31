import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Público: ¿hay algún agente de soporte disponible ahora?
// Lo usa la burbuja para mostrar "En línea" o "Te respondemos por correo".
export async function GET() {
  try {
    const { count } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_admin', true)
      .eq('available', true);
    return NextResponse.json({ online: (count || 0) > 0, agents: count || 0 });
  } catch {
    return NextResponse.json({ online: false, agents: 0 });
  }
}
