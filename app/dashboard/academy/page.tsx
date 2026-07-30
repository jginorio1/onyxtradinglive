import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import AcademyClient from './AcademyClient';

export const dynamic = 'force-dynamic';

export default async function AcademyPage() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  return (
    <div className="wrap-wide" style={{ padding: '24px 0' }}>
      <AcademyClient />
    </div>
  );
}
