import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import AccountClient from './AccountClient';

export const dynamic = 'force-dynamic';

export default async function Account() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  return <AccountClient email={user.email || ''} />;
}
