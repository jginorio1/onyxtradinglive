import type { Metadata } from 'next';
import Link from 'next/link';
import { serverLang, localeAlternates } from '@/lib/locale';
import { buildMediaKit } from '@/lib/mediakit';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  return {
    title: es ? 'Media Kit · Estadísticas de publicidad · Onyx Trading Live' : 'Media Kit · Advertising stats · Onyx Trading Live',
    description: es ? 'Estadísticas por página, audiencia e inventario publicitario de Onyx Trading Live. Datos reales para anunciantes.'
                    : 'Per-page stats, audience and ad inventory for Onyx Trading Live. Real data for advertisers.',
    alternates: localeAlternates('/publicidad/estadisticas'),
  };
}

const TIER_LABEL: Record<string, { es: string; en: string; color: string }> = {
  t1: { es: 'Tier 1 · US/UK/CA/AU/EU', en: 'Tier 1 · US/UK/CA/AU/EU', color: '#e8b64c' },
  t2: { es: 'Tier 2 · LatAm/EU/Asia', en: 'Tier 2 · LatAm/EU/Asia', color: '#a679ff' },
  t3: { es: 'Tier 3 · Resto', en: 'Tier 3 · Rest', color: '#5fd08a' },
};
const unitLabel = (u: string, es: boolean) =>
  u === 'month' ? (es ? '/mes' : '/mo') : u === 'cpm' ? ' CPM' : u === 'cpc' ? ' CPC' : u === 'cpa' ? ' CPA' : (es ? '/sem' : '/wk');

export default async function MediaKitStats() {
  const es = serverLang() === 'es';
  const kit = await buildMediaKit();
  const L = (a: string, b: string) => (es ? a : b);
  const nf = (n: number) => n.toLocaleString('en-US'); // miles con coma (95,587) en ambos idiomas
  const { totals, groups, audience, packages, branding } = kit;
  const t = audience.tiers;
  // conic-gradient para el donut de tiers
  const g1 = t.t1, g2 = t.t1 + t.t2;
  const donut = `conic-gradient(#e8b64c 0 ${g1}%, #a679ff ${g1}% ${g2}%, #5fd08a ${g2}% 100%)`;

  const kpi = (v: string, label: string, gold = false) => (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: gold ? 'var(--brand)' : 'var(--tx)' }}>{v}</div>
      <div className="muted" style={{ fontSize: 12.5 }}>{label}</div>
    </div>
  );

  return (
    <div className="wrap section" style={{ maxWidth: 1000 }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <span style={{ background: 'var(--brand)', color: '#0b0f1e', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 20 }}>MEDIA KIT</span>
        <h1 style={{ fontSize: 30, marginTop: 12 }}>{L('Estadísticas para anunciantes', 'Advertiser statistics')}</h1>
        <p className="muted" style={{ fontSize: 16, marginTop: 8, maxWidth: 660, marginInline: 'auto' }}>
          {es ? branding.headlineEs : branding.headlineEn}
        </p>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          {L('Datos de los últimos 30 días · se actualizan solos', 'Last 30 days · updates automatically')}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 20 }}>
        {kpi(nf(totals.visitors), L('Visitantes / mes', 'Visitors / mo'))}
        {kpi(nf(totals.pageviews), L('Páginas vistas / mes', 'Pageviews / mo'))}
        {kpi(totals.avgTime, L('Tiempo medio', 'Avg. time'))}
        {kpi(totals.ctrPct + '%', 'CTR', true)}
      </div>

      {/* Rendimiento por página + Audiencia */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 16, marginTop: 22 }} className="mk-grid">
        <div className="card">
          <h3 style={{ marginBottom: 4 }}>{L('Rendimiento por página', 'Performance by page')}</h3>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
            {L('Dónde aparecen los banners, con qué tamaños y qué espacios están libres.', 'Where banners appear, in which sizes, and which spaces are open.')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groups.map((g) => (
              <div key={g.key} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: 'var(--bg2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                  <strong style={{ fontSize: 14 }}>{es ? g.es : g.en}</strong>
                  <span className="muted" style={{ fontSize: 12 }}>{nf(g.pageviews)} {L('vistas', 'views')}{g.key !== 'site' ? ` · ${nf(g.visitors)} ${L('visitantes', 'visitors')}` : ''}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {g.slots.map((s) => (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', fontSize: 12.5 }}>
                      <span style={{ fontFamily: 'monospace', color: 'var(--brand)' }}>{s.size}</span>
                      <span className="muted">{es ? s.es.split('·').pop()?.trim() : s.en.split('·').pop()?.trim()}</span>
                      {branding.showPrices && <span style={{ fontWeight: 700 }}>${s.price}{unitLabel(s.unit, es)}</span>}
                      <span style={{ fontSize: 11, color: s.available ? '#5fd08a' : 'var(--brand)' }}>
                        ● {s.available ? L('libre', 'open') : L('ocupado', 'booked')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>{L('Audiencia', 'Audience')}</h3>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 92, height: 92, borderRadius: '50%', background: donut, flex: 'none' }} />
              <div style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(['t1', 't2', 't3'] as const).map((k) => (
                  <div key={k}><span style={{ color: TIER_LABEL[k].color }}>●</span> {es ? TIER_LABEL[k].es : TIER_LABEL[k].en} <strong>{(t as any)[k]}%</strong></div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)', fontSize: 12.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="muted">{L('Móvil', 'Mobile')}</span><strong>{totals.mobilePct}%</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}><span className="muted">{L('Escritorio', 'Desktop')}</span><strong>{100 - totals.mobilePct}%</strong></div>
            </div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 12, lineHeight: 1.55 }}>{es ? audience.es : audience.en}</p>
          </div>

          {audience.topCountries.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: 10, fontSize: 15 }}>{L('Países principales', 'Top countries')}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {audience.topCountries.map((c) => (
                  <span key={c.code} style={{ border: '1px solid var(--line)', borderRadius: 20, padding: '3px 10px', fontSize: 12 }}>{c.code} · {nf(c.n)}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Paquetes */}
      <div style={{ marginTop: 26 }}>
        <h2 style={{ fontSize: 22, marginBottom: 4 }}>{L('Paquetes', 'Packages')}</h2>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>{L('Proyección de impresiones estimada según el tráfico real del último mes.', 'Estimated impressions based on last month’s real traffic.')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {packages.map((p) => (
            <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <strong style={{ fontSize: 16 }}>{es ? p.es : p.en}</strong>
              {branding.showPrices && (
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>
                  {p.priceMonthly > 0 ? `$${nf(p.priceMonthly)}` : L('A medida', 'Custom')}
                  {p.priceMonthly > 0 && <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>{L('/mes', '/mo')}</span>}
                </div>
              )}
              <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{es ? p.descEs : p.descEn}</p>
              {p.estImpressions > 0 && <div style={{ fontSize: 12, color: '#5fd08a' }}>~{nf(p.estImpressions)} {L('impresiones est.', 'est. impressions')}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="card" style={{ marginTop: 26, textAlign: 'center', padding: 26 }}>
        <h3 style={{ marginBottom: 8 }}>{L('¿Listo para anunciarte?', 'Ready to advertise?')}</h3>
        <p className="muted" style={{ fontSize: 14, maxWidth: 520, margin: '0 auto 16px' }}>
          {L('Reserva tu espacio o descarga la propuesta completa en PDF para compartir con tu equipo.', 'Book your space or download the full proposal PDF to share with your team.')}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" href={es ? '/publicidad' : '/en/publicidad'}>{L('Reservar espacio', 'Book a space')}</Link>
          <Link className="btn btn-ghost" href={es ? '/publicidad/propuesta' : '/en/publicidad/propuesta'} target="_blank">{L('Descargar propuesta (PDF)', 'Download proposal (PDF)')}</Link>
          <a className="btn btn-ghost" href={`mailto:${branding.contactEmail}`}>{L('Escríbenos', 'Contact us')}</a>
        </div>
      </div>

      <style>{`@media (max-width: 760px){ .mk-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
