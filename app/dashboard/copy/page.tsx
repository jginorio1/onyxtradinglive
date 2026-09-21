import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import CopyClient from './CopyClient';

export const dynamic = 'force-dynamic';

export default async function CopyPage() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  return <CopyClient />;
}
