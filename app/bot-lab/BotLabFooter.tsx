'use client';
import Link from 'next/link';
import { useLang } from '@/lib/lang';

// Pie DEDICADO de Onyx Bot Lab (solo sus enlaces). El layout lo usa en las rutas
// de Bot Lab en lugar del pie global.
export default function BotLabFooter() {
  const { lang } = useLang();
  const es = lang === 'es';
  const links: [string, string][] = [
    ['/bot-lab', 'Marketplace'],
    ['/bot-lab#vende', es ? 'Vender' : 'Sell'],
    ['/bot-lab#servicio', es ? 'Servicios' : 'Services'],
    ['/bot-lab#precios', es ? 'Precios' : 'Pricing'],
    ['/bot-lab/faq', 'FAQ'],
  ];
  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,.07)', marginTop: 20, padding: '24px 0 30px' }}>
      <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <Link href="/bot-lab" className="logo" style={{ fontSize: 15, gap: 9 }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(120deg,var(--gold,#ffd45e),#ffb020)', color: '#3a2a06', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>◆</span>
          Onyx Bot Lab
        </Link>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', color: 'var(--mut)', fontSize: 13.5 }}>
          {links.map(([h, l]) => <Link key={h} href={h} style={{ color: 'var(--mut)' }}>{l}</Link>)}
          <a href="/" style={{ color: 'var(--brand)' }}>← Onyx Trading Live</a>
        </div>
      </div>
      <div className="wrap" style={{ marginTop: 12 }}>
        <span className="muted" style={{ fontSize: 12 }}>© 2026 Onyx Bot Lab · {es ? 'El trading conlleva riesgo; los resultados pasados no garantizan resultados futuros.' : 'Trading involves risk; past results do not guarantee future results.'}</span>
      </div>
    </footer>
  );
}
