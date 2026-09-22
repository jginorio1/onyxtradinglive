import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { slotByKey } from '@/lib/ads';
import { serverLang } from '@/lib/locale';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false } }; // el reporte no se indexa

function fmt(iso: string | null, es: boolean) { try { return iso ? new Date(iso).toLocaleDateString(es ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; } catch { return '—'; } }

export default async function AdReport({ params }: { params: { token: string } }) {
  const es = serverLang() === 'es';
  const L = (a: string, b: string) => (es ? a : b);
  const { data } = await supabaseAdmin.from('ad_campaigns')
    .select('advertiser,slot_key,impressions,clicks,starts_at,ends_at,status').eq('report_token', params.token).maybeSingle();

  if (!data) return (
    <div className="wrap section" style={{ maxWidth: 640, textAlign: 'center' }}>
      <h1 style={{ fontSize: 24 }}>{L('Reporte no encontrado', 'Report not found')}</h1>
      <p className="muted">{L('El enlace no es válido o la campaña fue eliminada.', 'The link is invalid or the campaign was removed.')}</p>
    </div>
  );

  const c: any = data;
  const slot = slotByKey(c.slot_key);
  const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0.00';
  const stLbl: Record<string, [string, string]> = { active: ['Activa', 'Active'], paused: ['Pausada', 'Paused'], draft: ['Pendiente de pago', 'Awaiting payment'], ended: ['Terminada', 'Ended'], scheduled: ['Programada', 'Scheduled'] };

  const stat = (label: string, value: string) => (
    <div className="card" style={{ textAlign: 'center', padding: '18px 12px' }}>
      <div style={{ fontSize: 26, fontWeight: 800 }}>{value}</div>
      <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{label}</div>
    </div>
  );

  return (
    <div className="wrap section" style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 20 }}>
        <div className="muted" style={{ fontSize: 12 }}>{L('Reporte de campaña · Onyx', 'Campaign report · Onyx')}</div>
        <h1 style={{ fontSize: 26, margin: '4px 0' }}>{c.advertiser || L('Anunciante', 'Advertiser')}</h1>
        <div className="muted" style={{ fontSize: 14 }}>{slot ? (es ? slot.es : slot.en) + ' · ' + slot.size : c.slot_key} · {fmt(c.starts_at, es)} → {fmt(c.ends_at, es)} · {es ? (stLbl[c.status]?.[0] || c.status) : (stLbl[c.status]?.[1] || c.status)}</div>
      </div>

      <div className="grid g3" style={{ gap: 14, marginBottom: 20 }}>
        {stat(L('Impresiones', 'Impressions'), Number(c.impressions).toLocaleString())}
        {stat(L('Clics', 'Clicks'), Number(c.clicks).toLocaleString())}
        {stat('CTR', ctr + '%')}
      </div>

      <a className="btn btn-ghost" href={`/api/ads/report?token=${encodeURIComponent(params.token)}&format=csv`} style={{ fontSize: 13 }}>{L('Descargar CSV', 'Download CSV')}</a>
      <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>{L('Los datos se actualizan en tiempo real mientras la campaña está activa. Guarda este enlace: es tu acceso al reporte.', 'Data updates in real time while the campaign is active. Save this link: it’s your access to the report.')}</p>
    </div>
  );
}
