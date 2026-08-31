import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import Bots from './Bots';

export const dynamic = 'force-dynamic';

export default async function BotsPage() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  return <Bots />;
}
