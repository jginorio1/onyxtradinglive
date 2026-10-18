import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { classifyAI } from '@/lib/supportAI';
import { pickAssignee } from '@/lib/supportRoute';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST · PUENTE equipo → ticket. Convierte un mensaje/hilo del chat de equipo en
// un ticket de soporte formal (con triage IA + ruteo), para no perder un pendiente
// que surgió en la conversación interna. Lo usa el botón "Convertir en ticket".
// { subject, body, email?, category?, assignee_id? }
export async function POST(req: Request) {
  const g = await requirePerm('soporte', 'manage');
  if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({}));
    const subject = String(b.subject || '').trim().slice(0, 160) || 'Pendiente del equipo';
    const body = String(b.body || '').trim().slice(0, 4000);
    const email = String(b.email || '').trim().toLowerCase().slice(0, 160) || null;

    // Triage IA (categoría, prioridad, idioma, resumen) a partir del texto.
    const tri = await classifyAI(body || subject);

    // Crear el ticket. channel 'team' = nació en el chat interno. Tolerante a columnas.
    const base: any = { user_id: null, email, subject, category: tri.category, status: 'open', is_lead: false };
    const full: any = { ...base, channel: 'team', priority: tri.priority, lang: tri.lang, sentiment: tri.sentiment, ai_summary: tri.summary, source: 'team' };
    let ticket: any = null;
    for (const row of [full, { ...base, channel: 'team' }, base]) {
      const r = await supabaseAdmin.from('support_tickets').insert(row).select('id').single();
      if (!r.error && r.data) { ticket = r.data; break; }
    }
    if (!ticket) return NextResponse.json({ error: 'no se pudo crear el ticket' }, { status: 500 });

    // Primer mensaje con el contenido original + nota de origen.
    if (body) await supabaseAdmin.from('support_messages').insert({ ticket_id: ticket.id, sender: 'user', body }).then((r: any) => { if (r?.error) return null; });
    await supabaseAdmin.from('support_messages').insert({ ticket_id: ticket.id, sender: 'note', body: `🔗 Creado desde el chat de equipo por ${g.user?.email || 'un agente'}.` }).catch(() => {});

    // Asignar: al indicado, o por ruteo (idioma/categoría/carga).
    let to = String(b.assignee_id || '').trim() || null;
    if (!to) to = await pickAssignee({ category: tri.category, lang: tri.lang });
    if (to) {
      await supabaseAdmin.from('support_tickets').update({ assignee_id: to }).eq('id', ticket.id).catch(() => {});
      try { const { emitNotif } = await import('@/lib/emitNotif'); await emitNotif(to, 'support_assigned', { ignorePlan: true, url: '/admin#soporte', body: subject }); } catch {}
    }
    return NextResponse.json({ ok: true, ticket_id: ticket.id, assigned_to: to, category: tri.category, priority: tri.priority });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
