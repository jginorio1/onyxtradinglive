import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function nameOf(p: any) { return (p?.name || p?.full_name || (p?.email || '').split('@')[0] || 'Equipo'); }

// GET · sugerencias para el @-picker: compañeros, clientes y tickets.
// ?q=texto  (vacío = solo compañeros + Onyx AI)
export async function GET(req: Request) {
  const g = await requirePerm('chat', 'view');
  if (!g.ok) return NextResponse.json({ items: [] }, { status: 403 });
  try {
    const q = (new URL(req.url).searchParams.get('q') || '').trim().toLowerCase();
    const items: any[] = [];

    // Onyx AI siempre primero
    if (!q || 'onyx ai'.includes(q)) items.push({ type: 'user', id: 'onyx', label: 'Onyx AI', sub: 'IA' });

    // Compañeros de equipo
    const { data: team } = await supabaseAdmin.from('profiles').select('id,email,full_name').eq('is_admin', true).limit(50);
    (team || []).forEach((p: any) => {
      const nm = nameOf(p);
      if (!q || nm.toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q)) items.push({ type: 'user', id: p.id, label: nm, sub: p.email });
    });

    // Clientes y tickets solo si hay texto (para no traer todo)
    if (q.length >= 2) {
      const { data: clients } = await supabaseAdmin.from('profiles').select('id,email,full_name').ilike('email', `%${q}%`).limit(5);
      (clients || []).forEach((p: any) => items.push({ type: 'client', id: p.id, label: nameOf(p), sub: p.email }));

      const { data: tickets } = await supabaseAdmin.from('support_tickets').select('id,subject,email').ilike('subject', `%${q}%`).order('updated_at', { ascending: false }).limit(5);
      (tickets || []).forEach((t: any) => items.push({ type: 'ticket', id: t.id, label: t.subject || 'ticket', sub: t.email }));
    }

    return NextResponse.json({ items: items.slice(0, 12) });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
