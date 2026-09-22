import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { serverLang, localeAlternates } from '@/lib/locale';

export const dynamic = 'force-dynamic';

// Directorio de partners (brokers, prop firms, herramientas). Modelo CPA: los
// partners pagan por registro/fondeo. Los enlaces salen por /api/ads/partner
// (cuenta el clic) con rel="sponsored nofollow". Es el ángulo que más rinde en
// este nicho. F6.
export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  return {
    title: es ? 'Brokers y prop firms recomendados · Onyx' : 'Recommended brokers & prop firms · Onyx',
    description: es ? 'Directorio de brokers, prop firms y herramientas para traders, revisados por Onyx.' : 'Directory of brokers, prop firms and tools for traders, vetted by Onyx.',
    alternates: localeAlternates('/socios'),
  };
}

const CATS: { key: string; es: string; en: string }[] = [
  { key: 'broker', es: 'Brokers', en: 'Brokers' },
  { key: 'propfirm', es: 'Prop firms', en: 'Prop firms' },
  { key: 'tool', es: 'Herramientas', en: 'Tools' },
];

export default async function PartnersPage() {
  const es = serverLang() === 'es';
  const L = (a: string, b: string) => (es ? a : b);
  const { data } = await supabaseAdmin.from('ad_partners').select('*').eq('status', 'active').order('featured', { ascending: false }).order('rank', { ascending: true }).limit(120);
  const partners = (data || []) as any[];

  return (
    <div className="wrap section" style={{ maxWidth: 960 }}>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <h1 style={{ fontSize: 30 }}>{L('Socios recomendados', 'Recommended partners')}</h1>
        <p className="muted" style={{ fontSize: 15.5, marginTop: 8, maxWidth: 640, marginInline: 'auto' }}>
          {L('Brokers, prop firms y herramientas que trabajan con traders de Onyx. Algunos enlaces son patrocinados.',
             'Brokers, prop firms and tools that work with Onyx traders. Some links are sponsored.')}
        </p>
      </div>

      {partners.length === 0 && <p className="muted" style={{ textAlign: 'center' }}>{L('Pronto añadiremos socios aquí.', 'We’ll add partners here soon.')}</p>}

      {CATS.map((c) => {
        const list = partners.filter((p) => p.category === c.key);
        if (!list.length) return null;
        return (
          <div key={c.key} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 19, marginBottom: 12 }}>{es ? c.es : c.en}</h2>
            <div className="grid g3" style={{ gap: 14 }}>
              {list.map((p) => (
                <a key={p.id} href={`/api/ads/partner?id=${p.id}`} target="_blank" rel="sponsored nofollow noopener"
                   className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, textDecoration: 'none', color: 'inherit', position: 'relative', border: p.featured ? '1px solid var(--brand)' : undefined }}>
                  {p.featured && <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, fontWeight: 800, color: 'var(--brand)' }}>★ {L('Destacado', 'Featured')}</span>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {p.logo_url ? <img src={p.logo_url} alt={p.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'contain', background: '#fff2' }} /> : <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{p.name?.[0] || '?'}</div>}
                    <div style={{ fontSize: 15.5, fontWeight: 700 }}>{p.name}</div>
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>{es ? p.blurb_es : p.blurb_en}</div>
                  {p.regulated && <div className="muted" style={{ fontSize: 11 }}>{L('Regulado:', 'Regulated:')} {p.regulated}</div>}
                  <span style={{ color: 'var(--brand)', fontSize: 13, fontWeight: 700, marginTop: 'auto' }}>{L('Visitar →', 'Visit →')}</span>
                </a>
              ))}
            </div>
          </div>
        );
      })}

      <p className="muted" style={{ fontSize: 11.5, marginTop: 8, textAlign: 'center' }}>
        {L('Los enlaces marcados como patrocinados pueden generar una comisión para Onyx sin costo para ti. No es asesoría de inversión; opera con riesgo.',
           'Sponsored links may earn Onyx a commission at no cost to you. Not investment advice; trade at your own risk.')}
      </p>
      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <a href="/publicidad" style={{ color: 'var(--brand)', fontSize: 13.5, fontWeight: 600 }}>{L('¿Eres un broker o prop firm? Aparece aquí →', 'Broker or prop firm? Get listed →')}</a>
      </div>
    </div>
  );
}
