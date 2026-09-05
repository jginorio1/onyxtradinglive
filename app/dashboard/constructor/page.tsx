import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import BotBuilder from './BotBuilder';

export const dynamic = 'force-dynamic';

export default async function ConstructorPage() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  return <div style={{ padding: '18px 16px 60px' }}><BotBuilder /></div>;
}
