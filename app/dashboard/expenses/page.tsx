import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import Expenses from './Expenses';

export const dynamic = 'force-dynamic';

export default async function ExpensesPage() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  return <Expenses />;
}
