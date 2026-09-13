import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ambassadorOutreachSettings } from '@/lib/settings';
import { ambSettings } from '@/lib/ambassadors';
import { draftInvite } from '@/lib/ambassadorAI';
import { sendEmail } from '@/lib/mail';
import { logError } from '@/lib/errlog';

// ============================================================
// Auto-reclutamiento de embajadores. NO busca desconocidos: trabaja SOLO con los
// prospectos que TÚ cargaste (con email). Por cada corrida:
//  · Primer contacto: prospectos 'new' con email → la IA redacta la propuesta y la
//    envía; pasan a 'contacted'.
//  · Seguimiento: 'contacted' que no respondieron tras N días → un follow-up suave
//    (hasta maxFollowups). Los que respondieron ('replied'/'joined') no se tocan.
// ============================================================

const norm = (s: any) => String(s || '').trim();

export async function runAmbassadorOutreach(force = false): Promise<{ ran: boolean; reason?: string; contacted?: number; followed?: number }> {
  const cfg = await ambassadorOutreachSettings();
  if (!cfg.enabled && !force) return { ran: false, reason: 'disabled' };

  const s = await ambSettings();
  const rate = Number(s.tier_rate || 30);
  const couponPct = Number(s.coupon_percent || 20);
  let budget = Math.max(1, Math.min(200, cfg.perRun || 25));
  let contacted = 0, followed = 0;

  // Idioma del correo: usa el del prospecto si lo tuviera; por defecto español.
  const langOf = (p: any) => (p.lang === 'en' ? 'en' : 'es') as 'es' | 'en';

  // 1) PRIMER CONTACTO — prospectos nuevos con email.
  try {
    const { data } = await supabaseAdmin.from('ambassador_prospects')
      .select('*').eq('status', 'new').not('email', 'is', null).limit(budget);
    for (const p of (data || [])) {
      if (budget <= 0) break;
      if (!norm(p.email)) continue;
      const r = await draftInvite({ name: p.name, platform: p.platform || 'youtube', niche: p.niche || 'prop', lang: langOf(p), rate, couponPct });
      if (!r.ok || !r.body) { await logError('amb_outreach_draft', new Error(r.reason || 'draft_failed')); continue; }
      const ok = await sendEmail(norm(p.email), r.subject || 'Colaboración con Onyx Trading Live', r.body, { kind: 'ambassador_invite' });
      if (ok) {
        try { await supabaseAdmin.from('ambassador_prospects').update({ status: 'contacted', contacted_at: new Date().toISOString(), last_email_at: new Date().toISOString(), followups: 0, updated_at: new Date().toISOString() }).eq('id', p.id); } catch {}
        contacted++; budget--;
      }
    }
  } catch (e) { await logError('amb_outreach_new', e); }

  // 2) SEGUIMIENTO — contactados sin respuesta tras N días.
  if (budget > 0 && (cfg.maxFollowups || 0) > 0) {
    try {
      const cutoff = new Date(Date.now() - (cfg.followupDays || 4) * 86400000).toISOString();
      const { data } = await supabaseAdmin.from('ambassador_prospects')
        .select('*').eq('status', 'contacted').not('email', 'is', null)
        .lt('last_email_at', cutoff).limit(budget);
      for (const p of (data || [])) {
        if (budget <= 0) break;
        if ((Number(p.followups) || 0) >= (cfg.maxFollowups || 2)) continue;
        const r = await draftInvite({ name: p.name, platform: p.platform || 'youtube', niche: p.niche || 'prop', lang: langOf(p), rate, couponPct, followup: true });
        if (!r.ok || !r.body) continue;
        const ok = await sendEmail(norm(p.email), r.subject || 'Onyx · seguimiento', r.body, { kind: 'ambassador_invite' });
        if (ok) {
          try { await supabaseAdmin.from('ambassador_prospects').update({ followups: (Number(p.followups) || 0) + 1, last_email_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', p.id); } catch {}
          followed++; budget--;
        }
      }
    } catch (e) { await logError('amb_outreach_followup', e); }
  }

  return { ran: true, reason: 'ok', contacted, followed };
}
