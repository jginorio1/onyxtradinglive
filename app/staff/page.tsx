import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import StaffClient from './StaffClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mi nómina · Onyx Trading Live', robots: { index: false, follow: false } };

export default async function StaffPage() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  return <StaffClient />;
}
