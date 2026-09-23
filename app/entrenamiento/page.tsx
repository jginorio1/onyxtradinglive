import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import TrainingClient from './TrainingClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Centro de formación · Onyx', robots: { index: false, follow: false } };

// Área de estudio interna (empleados + vendedores). El acceso se comprueba en la
// API /api/training; aquí solo exigimos sesión.
export default async function EntrenamientoPage() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  return <TrainingClient />;
}
