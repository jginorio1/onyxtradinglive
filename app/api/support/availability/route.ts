import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Público: ¿hay algún agente de soporte disponible ahora?
// Lo usa la burbuja para mostrar "En línea" o "Te respondemos por correo".
//
// Contamos por `available = true` (no por is_admin), porque esa columna SOLO la
// puede poner en true un miembro del equipo desde el panel (ruta autenticada), y
// así también cuenta al dueño que entra por ADMIN_EMAILS (cuyo perfil puede tener
// is_admin = false). Eso corregía el caso de "toggle en verde pero agents: 0".
export async function GET() {
  try {
    const { count } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('available', true);
    return NextResponse.json({ online: (count || 0) > 0, agents: count || 0 });
  } catch {
    return NextResponse.json({ online: false, agents: 0 });
  }
}
