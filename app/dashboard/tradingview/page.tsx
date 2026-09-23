import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import TradingViewClient from './TradingViewClient';

export const dynamic = 'force-dynamic';

export default async function TradingViewPage() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  return <TradingViewClient />;
}
