import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import SupportClient from './SupportClient';

export const dynamic = 'force-dynamic';

export default async function SupportPage() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  return <SupportClient />;
}
