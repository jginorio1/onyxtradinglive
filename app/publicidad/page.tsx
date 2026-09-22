import type { Metadata } from 'next';
import { rateCard } from '@/lib/ads';
import { serverLang, localeAlternates } from '@/lib/locale';
import ReserveForm from './ReserveForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  return {
    title: es ? 'Anúnciate en Onyx Trading Live · Publicidad para traders' : 'Advertise on Onyx Trading Live · Ads for traders',
    description: es ? 'Llega a miles de traders de prop firms y forex. Espacios patrocinados en el blog y la web, con precios por ubicación y tamaño.'
                    : 'Reach thousands of prop-firm and forex traders. Sponsored spaces on the blog and site, priced by placement and size.',
    alternates: localeAlternates('/publicidad'),
  };
}

const unitLabel = (u: string, es: boolean) => (u === 'week' ? (es ? '/ semana' : '/ week') : u === 'month' ? (es ? '/ mes' : '/ month') : 'CPM');

export default async function AdvertisePage() {
  const es = serverLang() === 'es';
  const L = (a: string, b: string) => (es ? a : b);
  const rates = await rateCard();
  const slots = rates.map((r) => ({ key: r.key, name: es ? r.es : r.en, size: r.size, priceLabel: `$${r.price} ${unitLabel(r.unit, es)}` }));

  return (
    <div className="wrap section" style={{ maxWidth: 920 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 30 }}>{L('Anúnciate en Onyx', 'Advertise on Onyx')}</h1>
        <p className="muted" style={{ fontSize: 16, marginTop: 8, maxWidth: 640, marginInline: 'auto' }}>
          {L('Conecta con una audiencia comprometida de traders de prop firms, forex y cripto. Espacios propios (no una red externa): cargan rápido, no los bloquean y rinden mejor.',
             'Reach an engaged audience of prop-firm, forex and crypto traders. Self-hosted spaces (not a third-party network): they load fast, aren’t blocked, and perform better.')}
        </p>
      </div>

      {/* ¿Por qué anunciarte? */}
      <div className="grid g3" style={{ gap: 14, marginBottom: 26 }}>
        {[
          [L('Audiencia enfocada', 'Focused audience'), L('Traders activos que buscan brokers, prop firms, herramientas y formación.', 'Active traders looking for brokers, prop firms, tools and education.')],
          [L('Contenido en vivo', 'Live content'), L('Blog de noticias y guías que se actualiza a diario: tráfico constante y fresco.', 'A daily-updated news and guides blog: steady, fresh traffic.')],
          [L('Marca segura', 'Brand-safe'), L('Cada espacio etiquetado y moderado. Los enlaces respetan las reglas de SEO.', 'Every space labeled and moderated. Links follow SEO rules.')],
        ].map(([t, d], i) => (
          <div key={i} className="card"><div style={{ fontWeight: 700, marginBottom: 4 }}>{t}</div><div className="muted" style={{ fontSize: 13.5 }}>{d}</div></div>
        ))}
      </div>

      {/* Tarifario */}
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>{L('Espacios y precios', 'Spaces and prices')}</h2>
      <div className="grid g3" style={{ gap: 14, marginBottom: 26 }}>
        {rates.map((r) => (
          <div key={r.key} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{es ? r.es : r.en}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>{r.size} · {r.page}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>${r.price} <span style={{ fontSize: 13, color: 'var(--mut)', fontWeight: 500 }}>{unitLabel(r.unit, es)}</span></div>
            <a href="#reservar" style={{ color: 'var(--brand)', fontSize: 13.5, fontWeight: 600, textDecoration: 'none', marginTop: 'auto' }}>{L('Reservar →', 'Reserve →')}</a>
          </div>
        ))}
      </div>

      <ReserveForm slots={slots} es={es} />

      <p className="muted" style={{ fontSize: 12.5, marginTop: 18, textAlign: 'center' }}>
        {L('Los anuncios se muestran solo en la web y a usuarios del plan gratis. Especificaciones del creativo: PNG/JPG, tamaño exacto del espacio. Nos reservamos el derecho de rechazar contenido no apto.',
           'Ads show only on web and to free-plan users. Creative specs: PNG/JPG at the exact space size. We reserve the right to reject unsuitable content.')}
      </p>
    </div>
  );
}
