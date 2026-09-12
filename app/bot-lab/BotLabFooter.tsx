'use client';
import Link from 'next/link';
import { useLang } from '@/lib/lang';

// Pie DEDICADO de Onyx Bot Lab. Mismo esqueleto que el pie global (marca + CTA,
// columnas por categoría, aviso de riesgo, barra inferior) pero con la identidad
// dorada de Bot Lab. Responsive: en móvil las columnas se apilan y todo se alinea
// a la izquierda (clases .blf-* con reglas en globals.css).
export default function BotLabFooter() {
  const { lang } = useLang();
  const es = lang === 'es';
  const L = (a: string, b: string) => (es ? a : b);

  const cols: { title: string; items: [string, string][] }[] = [
    { title: 'Marketplace', items: [
      ['/bot-lab', L('Explorar robots', 'Browse robots')],
      ['/bot-lab#servicio', L('Servicios', 'Services')],
      ['/bot-lab#precios', L('Precios', 'Pricing')],
    ] },
    { title: L('Vender', 'Sell'), items: [
      ['/bot-lab#vende', L('Publicar un robot', 'List a robot')],
      ['/bot-lab/faq', L('Cómo funciona', 'How it works')],
    ] },
    { title: L('Aprender', 'Learn'), items: [
      ['/bot-lab/faq', 'FAQ'],
      ['/guia', L('Guía', 'Guide')],
      ['/contacto', L('Soporte', 'Support')],
    ] },
    { title: 'Legal', items: [
      ['/terms', L('Términos', 'Terms')],
      ['/privacy', L('Privacidad', 'Privacy')],
    ] },
  ];

  const email = 'botlab@onyxtradinglive.com';
  const lbl: any = { fontSize: 11, letterSpacing: '.05em', color: 'var(--mut)', fontWeight: 700, marginBottom: 9, textTransform: 'uppercase' };
  const lnk: any = { color: 'var(--mut)', fontSize: 13.5, textDecoration: 'none' };

  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,.08)', marginTop: 24 }}>
      <div className="wrap" style={{ padding: '28px 0 20px', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Fila de marca + CTA */}
        <div className="blf-brand" style={{ display: 'flex', flexWrap: 'wrap', gap: 18, justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: 18 }}>
          <div style={{ maxWidth: 320 }}>
            <Link href="/bot-lab" className="logo" style={{ fontSize: 16, gap: 9 }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(120deg,var(--gold,#ffd45e),#ffb020)', color: '#3a2a06', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>◆</span>
              Onyx Bot Lab
            </Link>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
              {L('Compra, vende y contrata robots de trading verificados. Un producto de Onyx Trading Live.',
                 'Buy, sell and hire verified trading robots. A product of Onyx Trading Live.')}
            </div>
          </div>
          <div className="blf-cta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
            <Link href="/bot-lab" className="btn btn-primary" style={{ background: 'linear-gradient(120deg,var(--gold,#ffd45e),#ffb020)', color: '#3a2a06', border: 'none' }}>{L('Explorar marketplace', 'Browse marketplace')}</Link>
            <a href={`mailto:${email}`} className="muted" style={{ fontSize: 12.5, textDecoration: 'none' }}>✉ {email}</a>
          </div>
        </div>

        {/* Columnas de enlaces */}
        <div className="blf-cols" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 22 }}>
          {cols.map((c, i) => (
            <div key={i}>
              <div style={lbl}>{c.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {c.items.map(([href, label], j) => (
                  <Link key={href + j} href={href} style={lnk}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--tx)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--mut)')}>{label}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Aviso de riesgo */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '11px 13px' }}>
          <span aria-hidden style={{ color: 'var(--amber)', flex: 'none', marginTop: 1 }}>⚠️</span>
          <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.65 }}>
            {L('El trading conlleva riesgo de pérdida total y no es apto para todos. Los resultados pasados no garantizan resultados futuros. Los robots son herramientas de software, no asesoría financiera.',
               'Trading involves risk of total loss and is not suitable for everyone. Past results do not guarantee future results. Robots are software tools, not financial advice.')}
            {' '}<Link href="/terms" style={{ color: 'var(--tx)', textDecoration: 'underline' }}>{L('Ver términos', 'See terms')}</Link>
          </div>
        </div>

        {/* Barra inferior */}
        <div className="blf-bottom" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--mut)' }}>
          <span>© 2026 Onyx Bot Lab</span>
          <a href="/" style={{ color: 'var(--brand)', textDecoration: 'none' }}>← Onyx Trading Live</a>
        </div>
      </div>
    </footer>
  );
}
