import type { Metadata } from 'next';
import { buildMediaKit, getProposalByToken, proposalToClient, bumpProposalView } from '@/lib/mediakit';
import PrintButton from './PrintButton';
import { serverLang } from '@/lib/locale';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Propuesta de publicidad · Onyx Trading Live', robots: { index: false, follow: false } };

const unit = (u: string) => (u === 'month' ? '/mo' : u === 'cpm' ? ' CPM' : u === 'cpc' ? ' CPC' : u === 'cpa' ? ' CPA' : '/wk');

// Documento imprimible (una sola página web, dos secciones de idioma). Diseñado
// para "Guardar como PDF" desde el navegador. Colores claros fijos (los PDFs son
// documentos, no dependen del tema de la app).
// Con ?t=TOKEN se personaliza para un cliente concreto (portada + nota + paquete).
export default async function ProposalDoc({ searchParams }: { searchParams?: { t?: string } }) {
  const token = (searchParams?.t || '').trim();
  const proposal = token ? await getProposalByToken(token) : null;
  if (proposal) bumpProposalView(token); // suma una vista (silencioso, no bloquea)
  const client = proposal ? proposalToClient(proposal) : null;
  const es = proposal ? proposal.lang !== 'en' : serverLang() === 'es';
  const kit = await buildMediaKit({ client });
  const nf = (n: number) => n.toLocaleString('en-US');
  const date = new Date().toLocaleDateString(es ? 'es-ES' : 'en-US', { year: 'numeric', month: 'long' });
  const { totals, groups, audience, packages, branding, disclaimer } = kit;
  const cl = kit.client;
  const t = audience.tiers;
  const donut = `conic-gradient(#c98a12 0 ${t.t1}%, #7b4fd0 ${t.t1}% ${t.t1 + t.t2}%, #2f9e63 ${t.t1 + t.t2}% 100%)`;

  // Un bloque de idioma (se repite ES y EN).
  const Block = ({ L }: { L: boolean }) => {
    const tr = (a: string, b: string) => (L ? a : b);
    return (
      <section className="mk-page">
        {/* Portada / cabecera */}
        <div className="mk-hero">
          <div className="mk-logo"><span className="mk-mark" /> Onyx Trading Live</div>
          <div className="mk-kicker">{tr('Kit de medios · Propuesta de publicidad', 'Media Kit · Advertising proposal')}</div>
          <h1>{tr('Llega a traders con intención de compra', 'Reach traders with buying intent')}</h1>
          <p className="mk-sub">{L ? branding.headlineEs : branding.headlineEn}</p>
          {cl?.company && (
            <div className="mk-for">{tr('Preparado para', 'Prepared for')}: <b>{cl.company}</b>{cl.contact ? ` · ${cl.contact}` : ''}</div>
          )}
          <div className="mk-date">{date}</div>
        </div>

        {/* Nota personal al cliente (si la propuesta es dirigida) */}
        {cl && (L ? cl.noteEs : cl.noteEn) && (
          <div className="mk-note">{L ? cl.noteEs : cl.noteEn}</div>
        )}

        {/* Quiénes somos */}
        <h2>{tr('Quiénes somos', 'Who we are')}</h2>
        <p>{L ? branding.aboutEs : branding.aboutEn}</p>

        {/* KPIs */}
        <div className="mk-kpis">
          <div><b>{nf(totals.visitors)}</b><span>{tr('Visitantes / mes', 'Visitors / mo')}</span></div>
          <div><b>{nf(totals.pageviews)}</b><span>{tr('Páginas vistas / mes', 'Pageviews / mo')}</span></div>
          <div><b>{totals.avgTime}</b><span>{tr('Tiempo medio', 'Avg. time')}</span></div>
          <div><b>{totals.ctrPct}%</b><span>CTR</span></div>
        </div>

        {/* Audiencia */}
        <h2>{tr('Audiencia', 'Audience')}</h2>
        <div className="mk-aud">
          <div className="mk-donut" style={{ background: donut }} />
          <div className="mk-legend">
            <div><i style={{ background: '#c98a12' }} /> {tr('Tier 1 · US/UK/CA/AU/EU', 'Tier 1 · US/UK/CA/AU/EU')} <b>{t.t1}%</b></div>
            <div><i style={{ background: '#7b4fd0' }} /> {tr('Tier 2 · LatAm/EU/Asia', 'Tier 2 · LatAm/EU/Asia')} <b>{t.t2}%</b></div>
            <div><i style={{ background: '#2f9e63' }} /> {tr('Tier 3 · Resto', 'Tier 3 · Rest')} <b>{t.t3}%</b></div>
            <div className="mk-muted">{tr('Móvil', 'Mobile')} {totals.mobilePct}% · {tr('Escritorio', 'Desktop')} {100 - totals.mobilePct}%</div>
          </div>
        </div>
        <p className="mk-small">{L ? audience.es : audience.en}</p>

        {/* Inventario */}
        <h2>{tr('Inventario y tarifas', 'Inventory & rates')}</h2>
        <table className="mk-table">
          <thead><tr><th>{tr('Ubicación', 'Placement')}</th><th>{tr('Tamaño', 'Size')}</th><th>{tr('Tráfico/mes', 'Traffic/mo')}</th>{branding.showPrices && <th>{tr('Precio', 'Price')}</th>}<th>{tr('Estado', 'Status')}</th></tr></thead>
          <tbody>
            {groups.flatMap((g) => g.slots.map((s) => (
              <tr key={s.key}>
                <td>{(L ? g.es : g.en)} — {(L ? s.es : s.en).split('·').pop()?.trim()}</td>
                <td className="mk-mono">{s.size}</td>
                <td>{nf(g.pageviews)}</td>
                {branding.showPrices && <td><b>${s.price}</b>{unit(s.unit)}</td>}
                <td style={{ color: s.available ? '#2f9e63' : '#c98a12' }}>{s.available ? tr('Libre', 'Open') : tr('Ocupado', 'Booked')}</td>
              </tr>
            )))}
          </tbody>
        </table>

        {/* Paquetes */}
        <h2>{tr('Paquetes', 'Packages')}</h2>
        <div className="mk-packs">
          {packages.map((p) => {
            const rec = cl?.packageId && p.id === cl.packageId;
            return (
              <div key={p.id} className={'mk-pack' + (rec ? ' mk-pack-rec' : '')}>
                {rec && <div className="mk-pack-tag">{tr('Recomendado para ti', 'Recommended for you')}</div>}
                <div className="mk-pack-name">{L ? p.es : p.en}</div>
                {branding.showPrices && <div className="mk-pack-price">{p.priceMonthly > 0 ? `$${nf(p.priceMonthly)}/mo` : tr('A medida', 'Custom')}</div>}
                <div className="mk-pack-desc">{L ? p.descEs : p.descEn}</div>
                {p.estImpressions > 0 && <div className="mk-pack-imp">~{nf(p.estImpressions)} {tr('impresiones est.', 'est. impressions')}</div>}
              </div>
            );
          })}
        </div>

        {/* Contacto */}
        <h2>{tr('Siguiente paso', 'Next step')}</h2>
        <p>{tr('Reserva tu espacio o escríbenos para un plan a medida (patrocinio, CPA/afiliado, billboard).', 'Book your space or contact us for a custom plan (sponsorship, CPA/affiliate, billboard).')} <b>{branding.contactEmail}</b> · onyxtradinglive.com/publicidad</p>

        <p className="mk-legal">{L ? disclaimer.es : disclaimer.en}</p>
      </section>
    );
  };

  return (
    <>
      <PrintButton es={es} />
      <div className="mk-doc">
        <Block L={es} />
        <div className="mk-divider" />
        <Block L={!es} />
      </div>

      <style>{`
        .mk-doc { background:#fff; color:#1a2233; max-width:820px; margin:0 auto; padding:0 0 40px;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; line-height:1.55; }
        .mk-page { padding:34px 46px; }
        .mk-hero { background:linear-gradient(135deg,#0b0f1e,#1e2a4a); color:#fff; margin:0 -46px 26px; padding:34px 46px; }
        .mk-logo { display:flex; align-items:center; gap:9px; font-weight:800; font-size:17px; }
        .mk-mark { width:22px; height:22px; border-radius:6px; background:linear-gradient(135deg,#e8b64c,#a679ff); display:inline-block; }
        .mk-kicker { color:#e8b64c; font-size:12px; font-weight:700; letter-spacing:.05em; margin-top:16px; text-transform:uppercase; }
        .mk-hero h1 { font-size:27px; margin:8px 0 6px; color:#fff; }
        .mk-sub { color:#c9d3e6; font-size:14px; margin:0; max-width:560px; }
        .mk-for { color:#fff; font-size:13px; margin-top:12px; background:rgba(232,182,76,.16); border:1px solid rgba(232,182,76,.5); border-radius:8px; padding:7px 12px; display:inline-block; }
        .mk-date { color:#8b97b3; font-size:12px; margin-top:14px; }
        .mk-note { background:#faf4e6; border:1px solid #e8b64c66; border-left:4px solid #e8b64c; border-radius:8px; padding:12px 14px; font-size:13px; color:#5a4a24; margin:16px 0 4px; white-space:pre-wrap; }
        .mk-pack-rec { border:2px solid #e8b64c; box-shadow:0 4px 14px rgba(232,182,76,.25); }
        .mk-pack-tag { background:#e8b64c; color:#0b0f1e; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; border-radius:20px; padding:2px 8px; display:inline-block; margin-bottom:6px; }
        .mk-doc h2 { font-size:16px; color:#0b0f1e; border-bottom:2px solid #e8b64c; padding-bottom:4px; margin:24px 0 10px; display:inline-block; }
        .mk-doc p { font-size:13.5px; margin:0 0 10px; }
        .mk-small { font-size:12.5px; color:#556; }
        .mk-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin:14px 0 4px; }
        .mk-kpis > div { background:#f7f8fb; border:1px solid #e6e9f0; border-radius:9px; padding:12px; text-align:center; }
        .mk-kpis b { display:block; font-size:22px; color:#0b0f1e; }
        .mk-kpis span { font-size:11px; color:#667; }
        .mk-aud { display:flex; gap:20px; align-items:center; margin:6px 0 10px; }
        .mk-donut { width:96px; height:96px; border-radius:50%; flex:none; }
        .mk-legend { font-size:13px; display:flex; flex-direction:column; gap:5px; }
        .mk-legend i { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:6px; }
        .mk-muted { color:#778; font-size:12px; margin-top:2px; }
        .mk-table { width:100%; border-collapse:collapse; font-size:12.5px; margin:6px 0; }
        .mk-table th { text-align:left; color:#667; border-bottom:2px solid #e6e9f0; padding:6px 8px; font-weight:600; }
        .mk-table td { border-bottom:1px solid #eef0f5; padding:6px 8px; }
        .mk-mono { font-family:ui-monospace,Menlo,monospace; color:#7b4fd0; }
        .mk-packs { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin:8px 0; }
        .mk-pack { border:1px solid #e6e9f0; border-radius:10px; padding:12px; background:#fbfcfe; }
        .mk-pack-name { font-weight:800; font-size:14px; }
        .mk-pack-price { color:#c98a12; font-weight:800; font-size:18px; margin:4px 0; }
        .mk-pack-desc { font-size:12px; color:#556; }
        .mk-pack-imp { font-size:11.5px; color:#2f9e63; margin-top:6px; }
        .mk-legal { font-size:10.5px; color:#889; margin-top:18px; border-top:1px solid #eef0f5; padding-top:10px; }
        .mk-divider { height:0; border-top:2px dashed #d6dae6; margin:0 46px; }
        @media print {
          .no-print { display:none !important; }
          .mk-doc { max-width:none; }
          .mk-page { page-break-after:always; padding:24px 30px; }
          .mk-divider { display:none; }
          @page { margin:12mm; }
        }
      `}</style>
    </>
  );
}
