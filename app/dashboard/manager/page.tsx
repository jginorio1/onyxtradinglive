import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import ManagerClient from './ManagerClient';

export const dynamic = 'force-dynamic';

export default async function ManagerPage() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  return <ManagerClient />;
}
