import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ---------- KIT DE MATERIALES ----------
export async function listAssets(lang: 'es' | 'en' = 'es', onlyActive = true): Promise<any[]> {
  let q = supabaseAdmin.from('sales_assets').select('*').order('sort', { ascending: true }).order('created_at', { ascending: false });
  if (onlyActive) q = q.eq('active', true);
  const { data } = await q;
  return (data || []).filter((a: any) => onlyActive ? (a.lang === 'all' || a.lang === lang) : true);
}
export async function saveAsset(a: any): Promise<{ ok: boolean; id?: string }> {
  const row: any = {
    kind: ['link', 'script', 'image', 'pdf', 'video'].includes(a.kind) ? a.kind : 'link',
    title: String(a.title || '').slice(0, 160),
    body: a.body != null ? String(a.body).slice(0, 6000) : null,
    url: a.url != null ? String(a.url).slice(0, 800) : null,
    lang: ['es', 'en', 'all'].includes(a.lang) ? a.lang : 'es',
    sort: Number(a.sort) || 0,
    active: a.active !== false,
  };
  if (a.id) { await supabaseAdmin.from('sales_assets').update(row).eq('id', a.id); return { ok: true, id: a.id }; }
  const { data } = await supabaseAdmin.from('sales_assets').insert(row).select('id').maybeSingle();
  return { ok: true, id: (data as any)?.id };
}
export async function delAsset(id: string): Promise<void> { await supabaseAdmin.from('sales_assets').delete().eq('id', id); }

// ---------- MINI-CRM: NOTAS Y SEGUIMIENTO ----------
export async function notesForClient(repId: string, clientUserId: string): Promise<any[]> {
  const { data } = await supabaseAdmin.from('sales_client_notes')
    .select('*').eq('rep_id', repId).eq('client_user_id', clientUserId).order('created_at', { ascending: false }).limit(50);
  return data || [];
}
export async function addNote(repId: string, clientUserId: string, note: string, followupAt?: string | null): Promise<void> {
  await supabaseAdmin.from('sales_client_notes').insert({
    rep_id: repId, client_user_id: clientUserId, note: String(note || '').slice(0, 2000),
    followup_at: followupAt || null,
  });
}
export async function setNoteDone(repId: string, noteId: string, done: boolean): Promise<void> {
  await supabaseAdmin.from('sales_client_notes').update({ done }).eq('id', noteId).eq('rep_id', repId);
}
// Seguimientos pendientes (con recordatorio y sin marcar), para el badge del panel.
export async function pendingFollowups(repId: string): Promise<any[]> {
  const { data } = await supabaseAdmin.from('sales_client_notes')
    .select('id,client_user_id,note,followup_at').eq('rep_id', repId).eq('done', false)
    .not('followup_at', 'is', null).order('followup_at', { ascending: true }).limit(50);
  return data || [];
}

// ---------- PERFIL PÚBLICO / CONTRATO / FISCAL ----------
export async function saveRepProfile(repId: string, patch: { bio?: string; photo_url?: string }): Promise<void> {
  const row: any = {};
  if (patch.bio !== undefined) row.bio = String(patch.bio || '').slice(0, 600) || null;
  if (patch.photo_url !== undefined) row.photo_url = String(patch.photo_url || '').slice(0, 800) || null;
  if (Object.keys(row).length) await supabaseAdmin.from('sales_reps').update(row).eq('id', repId);
}
export async function signContract(repId: string, name: string): Promise<{ ok: boolean }> {
  const n = String(name || '').trim().slice(0, 120);
  if (!n) return { ok: false };
  await supabaseAdmin.from('sales_reps').update({ contract_signed_at: new Date().toISOString(), contract_name: n }).eq('id', repId);
  return { ok: true };
}
export async function saveTax(repId: string, formType: string, data: any): Promise<void> {
  const t = ['w9', 'w8', 'other', 'none'].includes(formType) ? formType : 'other';
  // Guardamos solo campos no sensibles; nunca números completos de cuenta.
  const safe: any = {};
  for (const k of ['legal_name', 'country', 'tax_id_last4', 'entity']) if (data && data[k] != null) safe[k] = String(data[k]).slice(0, 120);
  await supabaseAdmin.from('sales_reps').update({ tax_form_type: t, tax_data: safe }).eq('id', repId);
}
// Perfil público de un vendedor por su código (para el landing personalizado y el banner).
export async function repPublicProfile(code: string): Promise<{ name: string; bio: string | null; photo: string | null; code: string; canRecruit: boolean; roleName: string } | null> {
  const c = String(code || '').toLowerCase();
  const { data: rep } = await supabaseAdmin.from('sales_reps')
    .select('user_id,display_name,bio,photo_url,status,level,perms').eq('code', c).eq('status', 'active').maybeSingle();
  if (!rep) return null;
  let name = (rep as any).display_name;
  if (!name) { const { data: p } = await supabaseAdmin.from('profiles').select('name').eq('id', (rep as any).user_id).maybeSingle(); name = (p as any)?.name || 'Tu asesor Onyx'; }
  // ¿Puede reclutar? (permiso del nivel + override propio). Y nombre del nivel.
  let canRecruit = false, roleName = 'Asesor Onyx';
  try {
    const { salesSettings, permsFor } = await import('@/lib/sales');
    const s = await salesSettings();
    canRecruit = permsFor(rep as any, s).can_recruit;
    const lv = (rep as any).level;
    roleName = lv === 'l2' ? (s.level_names?.l2 || 'Director') : lv === 'l1' ? (s.level_names?.l1 || 'Lead') : (s.level_names?.vendedor || 'Asesor');
  } catch {}
  return { name, bio: (rep as any).bio || null, photo: (rep as any).photo_url || null, code: c, canRecruit, roleName };
}
