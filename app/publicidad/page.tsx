import type { Metadata } from 'next';
import { rateCard, slotAvailability } from '@/lib/ads';
import { serverLang, localeAlternates } from '@/lib/locale';
import BuyForm from './BuyForm';
import AdSlot from '@/app/components/AdSlot';

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
  const avail = await Promise.all(rates.map((r) => slotAvailability(r.key)));
  const buySlots = rates.map((r, i) => ({ key: r.key, name: es ? r.es : r.en, size: r.size, unit: r.unit, price: r.price, freeFrom: avail[i].freeFrom, bookedUntil: avail[i].bookedUntil }));

  return (
    <div className="wrap section" style={{ maxWidth: 920 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 30 }}>{L('Anúnciate en Onyx', 'Advertise on Onyx')}</h1>
        <p className="muted" style={{ fontSize: 16, marginTop: 8, maxWidth: 640, marginInline: 'auto' }}>
          {L('Conecta con una audiencia comprometida de traders de prop firms, forex y cripto. Espacios propios (no una red externa): cargan rápido, no los bloquean y rinden mejor.',
             'Reach an engaged audience of prop-firm, forex and crypto traders. Self-hosted spaces (not a third-party network): they load fast, aren’t blocked, and perform better.')}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          <a className="btn btn-primary" href={es ? '/publicidad/estadisticas' : '/en/publicidad/estadisticas'}>{L('Ver estadísticas (Media Kit)', 'See stats (Media Kit)')}</a>
          <a className="btn btn-ghost" href={es ? '/publicidad/propuesta' : '/en/publicidad/propuesta'} target="_blank">{L('Descargar propuesta (PDF)', 'Download proposal (PDF)')}</a>
        </div>
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

      {/* Espacio "Directorio · Partner destacado" (se muestra a visitantes; oculto
          a usuarios de pago y en nativo). Aquí es donde vive ese inventario. */}
      <AdSlot slot="directory_partner" lang={es ? 'es' : 'en'} />


      {/* Mapa visual: dónde cae cada espacio */}
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>{L('Dónde aparece tu anuncio', 'Where your ad appears')}</h2>
      <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>{L('Así se ven los espacios en la web. Cada bloque dorado es un lugar que puedes comprar.', 'Here’s how the spaces look on the site. Each gold block is a spot you can buy.')}</p>
      {(() => {
        const slot = (label: string, size: string, tall = false) => (
          <div style={{ border: '1.5px dashed var(--brand)', background: 'color-mix(in srgb, var(--brand) 9%, transparent)', color: 'var(--brand)', borderRadius: 8, padding: '7px 6px', fontSize: 10.5, fontWeight: 700, textAlign: 'center' as const, minHeight: tall ? 130 : 34, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', lineHeight: 1.3 }}>
            <span>{label}</span><span style={{ opacity: 0.7, fontWeight: 500 }}>{size}</span>
          </div>
        );
        const ph = (h: number, w = '100%') => <div style={{ background: 'var(--line)', borderRadius: 6, height: h, width: w }} />;
        const cardStyle = { border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg2, rgba(255,255,255,.02))' } as const;
        return (
          <div className="grid g3" style={{ gap: 14, marginBottom: 28 }}>
            {/* Landing */}
            <div style={cardStyle}>
              <div style={{ height: 28, display: 'flex', alignItems: 'center', gap: 5, padding: '0 10px', borderBottom: '1px solid var(--line)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f0666b' }} /><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e0a92e' }} /><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#43c463' }} /><span className="muted" style={{ fontSize: 10.5, marginLeft: 4 }}>{L('Portada', 'Landing')}</span></div>
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {slot(L('Billboard superior', 'Top billboard'), '970×250', true)}
                {ph(40)}{ph(28, '70%')}
                {slot('Leaderboard', '970×90')}
                {ph(30)}
                {slot(L('Footer global', 'Global footer'), '728×90')}
              </div>
            </div>
            {/* Blog / Artículo */}
            <div style={cardStyle}>
              <div style={{ height: 28, display: 'flex', alignItems: 'center', gap: 5, padding: '0 10px', borderBottom: '1px solid var(--line)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f0666b' }} /><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e0a92e' }} /><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#43c463' }} /><span className="muted" style={{ fontSize: 10.5, marginLeft: 4 }}>{L('Blog / Artículo', 'Blog / Article')}</span></div>
              <div style={{ padding: 10, display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {slot('Leaderboard', '728×90')}
                  {ph(26, '85%')}{ph(46)}
                  {slot(L('Dentro del texto', 'In-content'), '728×90')}
                  {ph(34)}
                  {slot(L('Tarjeta / Native', 'Card / Native'), '600×300')}
                </div>
                <div style={{ width: 76, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {slot('MPU', '300×250', false)}
                  {slot(L('Media pág.', 'Half-page'), '300×600', true)}
                </div>
              </div>
            </div>
            {/* Sticky + directorio */}
            <div style={cardStyle}>
              <div style={{ height: 28, display: 'flex', alignItems: 'center', gap: 5, padding: '0 10px', borderBottom: '1px solid var(--line)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f0666b' }} /><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e0a92e' }} /><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#43c463' }} /><span className="muted" style={{ fontSize: 10.5, marginLeft: 4 }}>{L('Todo el sitio + Directorio', 'Site-wide + Directory')}</span></div>
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 260 }}>
                {slot(L('Partner destacado (directorio)', 'Featured partner (directory)'), '600×300')}
                {ph(30)}{ph(30)}{ph(26, '60%')}
                <div style={{ marginTop: 'auto' }}>{slot(L('Barra sticky inferior (fija · más clics)', 'Bottom sticky bar (fixed · most clicks)'), '320×50')}</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tarifario */}
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>{L('Espacios y precios', 'Spaces and prices')}</h2>
      <div className="grid g3" style={{ gap: 14, marginBottom: 26 }}>
        {rates.map((r, i) => {
          const booked = avail[i].bookedUntil;
          const free = r.unit !== 'cpm' && !booked;
          return (
          <div key={r.key} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{es ? r.es : r.en}</div>
              {r.unit !== 'cpm' && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: free ? 'rgba(52,199,89,.15)' : 'rgba(201,138,0,.15)', color: free ? '#2e9e4f' : '#c98a00' }}>{free ? L('Disponible', 'Available') : L('Reservado', 'Booked')}</span>}
            </div>
            <div className="muted" style={{ fontSize: 12.5 }}>{r.size} · {r.page}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>${r.price} <span style={{ fontSize: 13, color: 'var(--mut)', fontWeight: 500 }}>{unitLabel(r.unit, es)}</span></div>
            <a href="#reservar" style={{ color: 'var(--brand)', fontSize: 13.5, fontWeight: 600, textDecoration: 'none', marginTop: 'auto' }}>{r.unit === 'cpm' ? L('Contactar →', 'Contact →') : L('Comprar →', 'Buy →')}</a>
          </div>
        );})}
      </div>

      <BuyForm slots={buySlots} es={es} />

      <p className="muted" style={{ fontSize: 12.5, marginTop: 18, textAlign: 'center' }}>
        {L('Los anuncios se muestran solo en la web y a usuarios del plan gratis. Especificaciones del creativo: PNG/JPG, tamaño exacto del espacio. Nos reservamos el derecho de rechazar contenido no apto.',
           'Ads show only on web and to free-plan users. Creative specs: PNG/JPG at the exact space size. We reserve the right to reject unsuitable content.')}
      </p>
    </div>
  );
}
