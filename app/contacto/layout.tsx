import type { Metadata } from 'next';
import { serverLang, localeAlternates } from '@/lib/locale';
import { getSeoMeta, seoFor } from '@/lib/seo';

// Meta editable desde Admin → SEO (página "Contacto"). Si vacío, usa el default.
export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const seo = seoFor(await getSeoMeta(), 'contacto', es,
    es ? 'Contacto y Soporte | Onyx Trading Live' : 'Contact & Support | Onyx Trading Live',
    es ? '¿Dudas sobre tu diario de trading, prop firm o copy trading? Escríbenos: soporte por IA o correo. Gestión de riesgo en forex y CFDs.'
       : 'Questions about your trading journal, funded account or copy trading? Reach Onyx support by AI or email. Risk help for forex and CFDs.');
  return { title: seo.title, description: seo.description, alternates: localeAlternates('/contacto') };
}

export default function ContactoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
