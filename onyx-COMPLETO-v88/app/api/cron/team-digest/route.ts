import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { teamDigest } from '@/lib/teamAI';
import { getSetting } from '@/lib/settings';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Publica cada mañana el resumen del turno (pendientes de anoche, leads nuevos,
// lo que espera respuesta) en un canal del chat de equipo, firmado por Onyx AI.
// Protegido con CRON_SECRET.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${secret}` || q === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try {
    // Idioma del resumen (ajustable en Ajustes → 'team_digest_lang'); por defecto español.
    const lang = ((await getSetting<string>('team_digest_lang', 'es')) === 'en' ? 'en' : 'es') as 'es' | 'en';

    // Canal destino: el configurado o, si no, el canal abierto (p. ej. #general).
    let channelId = await getSetting<string>('team_digest_channel', '');
    if (channelId) {
      const { data: ok } = await supabaseAdmin.from('chat_channels').select('id').eq('id', channelId).maybeSingle();
      if (!ok) channelId = '';
    }
    if (!channelId) {
      const { data: ch } = await supabaseAdmin.from('chat_channels').select('id').eq('kind', 'channel').order('created_at', { ascending: true }).limit(1).maybeSingle();
      channelId = (ch as any)?.id || '';
    }
    if (!channelId) return NextResponse.json({ ok: false, reason: 'no hay canal de equipo (corre supabase/chat.sql)' });

    const body = await teamDigest(lang);
    const { error } = await supabaseAdmin.from('chat_messages').insert({
      channel_id: channelId, sender_id: null, sender_name: 'Onyx AI', body, attachments: [], mentions: [],
    });
    if (error) return NextResponse.json({ ok: false, error: error.message });
    return NextResponse.json({ ok: true, channel: channelId });
  } catch (e: any) {
    await logError('team_digest', e);
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
