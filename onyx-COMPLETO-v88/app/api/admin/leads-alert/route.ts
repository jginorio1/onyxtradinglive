import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · consultas de clientes/leads recientes (24 h), con su primer mensaje.
// Ligero: lo consulta el aviso sticky del panel de admin cada ~20 s.
export async function GET() {
  const g = await requirePerm('soporte', 'view');
  if (!g.ok) return NextResponse.json({ error: 'no autorizado', tickets: [] }, { status: 403 });
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    let rows: any[] = [];
    {
      const r = await supabaseAdmin.from('support_tickets')
        .select('id,email,subject,category,priority,is_lead,created_at')
        .eq('is_lead', true).gte('created_at', since).order('created_at', { ascending: false }).limit(20);
      if (r.error) {
        const r2 = await supabaseAdmin.from('support_tickets').select('id,email,subject,category,is_lead,created_at')
          .eq('is_lead', true).gte('created_at', since).order('created_at', { ascending: false }).limit(20);
        rows = r2.data || [];
      } else rows = r.data || [];
    }
    const ids = rows.map((t) => t.id);
    const firstMsg: Record<string, string> = {};
    const aiMsg: Record<string, string> = {};   // última respuesta del AI por ticket
    if (ids.length) {
      const { data: msgs } = await supabaseAdmin.from('support_messages').select('ticket_id,sender,body,created_at')
        .in('ticket_id', ids).order('created_at', { ascending: true });
      for (const m of (msgs || []) as any[]) {
        if (m.sender === 'user' && !firstMsg[m.ticket_id]) firstMsg[m.ticket_id] = m.body;
        if (m.sender === 'ai') aiMsg[m.ticket_id] = m.body; // se queda con la más reciente
      }
    }
    const tickets = rows.map((t) => ({ id: t.id, email: t.email, subject: t.subject, category: t.category, priority: t.priority || 'normal', created_at: t.created_at, message: firstMsg[t.id] || t.subject || '', aiReply: aiMsg[t.id] || null }));
    return NextResponse.json({ tickets });
  } catch {
    return NextResponse.json({ tickets: [] });
  }
}
