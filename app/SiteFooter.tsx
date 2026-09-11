'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import BrandIcon from '@/app/components/BrandIcon';

// Footer multi-columna para TODAS las páginas: fila de marca + CTA, columnas de
// enlaces por categoría, contacto (QR + email + redes), aviso legal de riesgo y
// barra inferior. Lema, redes, email, QR y el texto legal se editan en
// Admin → Landing Builder (footer). En móvil las columnas se apilan.
export default function SiteFooter() {
  const { lang } = useLang();
  const es = lang === 'es';
  const [ver, setVer] = useState('');
  const [fx, setFx] = useState<any>(null);

  useEffect(() => {
    fetch('/api/version', { cache: 'no-store' }).then((r) => r.json()).then((j) => setVer(j.version || '')).catch(() => {});
    fetch('/api/landing-content?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json()).then((c) => setFx(c?.footer || null)).catch(() => {});
  }, []);

  const L = (a: string, b: string) => (es ? a : b);

  // Columnas por categoría (rutas reales de la app). Si el admin personalizó
  // enlaces en Landing Builder, los añadimos como columna extra "Más".
  const cols: { title: string; items: [string, string][] }[] = [
    { title: L('Producto', 'Product'), items: [
      ['/bot-lab', L('Bot Lab · Marketplace', 'Bot Lab · Marketplace')],
      ['/bot-builder', L('Crea tu bot', 'Build a bot')],
      ['/pricing', L('Planes', 'Plans')],
      ['/copy', 'Onyx Copy'],
    ] },
    { title: L('Recursos', 'Resources'), items: [
      ['/guia', L('Guía', 'Guide')],
      ['/blog', 'Blog'],
      ['/prop-firms', L('Prop firms', 'Prop firms')],
      ['/analiza', L('Analiza gratis', 'Free analysis')],
    ] },
    { title: L('Programa', 'Program'), items: [
      ['/embajadores', L('Embajadores', 'Ambassadors')],
      ['/invita', L('Invita y gana', 'Invite & earn')],
    ] },
    { title: L('Empresa', 'Company'), items: [
      ['/contacto', L('Contacto', 'Contact')],
      ['/terms', L('Términos', 'Terms')],
      ['/privacy', L('Privacidad', 'Privacy')],
      ['/cookies', 'Cookies'],
    ] },
  ];
  const known = new Set(cols.flatMap((c) => c.items.map(([h]) => h)));
  const extra: [string, string][] = (fx?.links || [])
    .map((l: any) => [l.href, es ? l.es : l.en] as [string, string])
    .filter(([h]: [string, string]) => h && !known.has(h));
  if (extra.length) cols.push({ title: L('Más', 'More'), items: extra });

  const tagline = (es ? (fx?.tagline_es) : (fx?.tagline_en)) || L('Tu trading bajo control: estadísticas en vivo, Onyx Guardian y robots.', 'Your trading under control: live stats, Onyx Guardian and robots.');
  const social: any[] = (fx?.social || []).filter((x: any) => x && x.url && x.on !== false);
  const email = (fx?.email || 'support@onyxtradinglive.com').trim();
  // QR: destino editable; por defecto el primer Telegram o el sitio.
  const tg = social.find((s) => /tele/i.test(s.platform || ''))?.url || '';
  const qrUrl = (fx?.qr_url || tg || (typeof window !== 'undefined' ? window.location.origin : 'https://onyxtradinglive.com')).trim();
  const qrHandle = (fx?.qr_handle || '').trim();
  const legal = (es ? (fx?.legal_es) : (fx?.legal_en)) || L(
    'Aviso legal: Onyx Trading Live es una herramienta de software; no somos asesores financieros ni ofrecemos servicios de inversión. Operar en FOREX y en general conlleva riesgo de pérdida total y no es apto para todos. Los resultados pasados no garantizan resultados futuros; los rendimientos hipotéticos tienen limitaciones inherentes. Nunca inviertas dinero que no puedas permitirte perder. Consulta a un profesional antes de operar.',
    'Legal notice: Onyx Trading Live is a software tool; we are not financial advisors and do not offer investment services. Trading FOREX and in general involves risk of total loss and is not suitable for everyone. Past results do not guarantee future results; hypothetical performance has inherent limitations. Never invest money you cannot afford to lose. Consult a professional before trading.',
  );

  const lbl = { fontSize: 11.5, letterSpacing: '.04em', color: 'var(--mut)', fontWeight: 700, marginBottom: 9, textTransform: 'uppercase' as const };
  const lnk = { color: 'var(--mut)', fontSize: 13.5, textDecoration: 'none' };

  return (
    <footer style={{ borderTop: '1px solid var(--line)', marginTop: 24 }}>
      <div className="wrap" style={{ padding: '30px 0 22px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Fila de marca + CTA */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--line)', paddingBottom: 20 }}>
          <div style={{ maxWidth: 440 }}>
            <Link href="/" className="logo" aria-label="Onyx Trading Live" style={{ fontSize: 16 }}>
              <img src="/onyx-symbol.png" alt="Onyx Trading Live" style={{ width: 26, height: 26, objectFit: 'contain' }} />
              <span className="logo-text">Onyx Trading Live</span>
            </Link>
            <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 8 }}>{tagline}</div>
            {social.length > 0 && (
              <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                {social.map((sc, i) => (
                  <a key={i} href={sc.url} target="_blank" rel="noopener noreferrer" aria-label={sc.platform} title={sc.platform}
                     style={{ color: 'var(--mut)', display: 'inline-flex' }}
                     onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--tx)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--mut)')}>
                    <BrandIcon name={sc.platform} size={20} />
                  </a>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
            <Link className="btn btn-primary" href="/login?mode=signup">{L('Empieza gratis', 'Start free')}</Link>
            {email && <a href={`mailto:${email}`} className="muted" style={{ fontSize: 12.5, textDecoration: 'none' }}>✉ {email}</a>}
          </div>
        </div>

        {/* Contacto (QR) + columnas de enlaces */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px 30px', alignItems: 'flex-start' }}>
          {qrUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '0 0 auto' }}>
              <span style={lbl}>{L('Contacto', 'Contact')}</span>
              <img src={`/api/qr?data=${encodeURIComponent(qrUrl)}&size=200&fg=0b1020&bg=ffffff`} alt={L('Código QR', 'QR code')} width={92} height={92} style={{ borderRadius: 10, background: '#fff', padding: 6 }} />
              {qrHandle && <span className="muted" style={{ fontSize: 12 }}>{qrHandle}</span>}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 22, flex: 1, minWidth: 240 }}>
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
        </div>

        {/* Aviso legal de riesgo */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px' }}>
          <span aria-hidden style={{ color: 'var(--amber)', flex: 'none', marginTop: 1 }}>⚠️</span>
          <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.65 }}>
            {legal} <Link href="/terms" style={{ color: 'var(--tx)', textDecoration: 'underline' }}>{L('Ver términos', 'See terms')}</Link>
          </div>
        </div>

        {/* Barra inferior */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--mut)' }}>
          <span>© 2026 Onyx Trading Live{ver ? <> · <span style={{ color: 'var(--tx)' }}>v{ver}</span></> : null}</span>
          <span>Español · English</span>
        </div>
      </div>
    </footer>
  );
}
