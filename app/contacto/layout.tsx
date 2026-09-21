import type { Metadata } from 'next';
import { serverLang, localeAlternates } from '@/lib/locale';
import { getSeoMeta, seoFor } from '@/lib/seo';

// Meta editable desde Admin → SEO (página "Contacto"). Si vacío, usa el default.
export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const seo = seoFor(await getSeoMeta(), 'contacto', es,
    es ? 'Contacto y soporte · Onyx Trading Live' : 'Contact & support · Onyx Trading Live',
    es ? 'Contáctanos: Onyx AI resuelve tus dudas al instante sobre conexión, Onyx Guardian, planes y fondeo; si hace falta, te responde una persona por correo.'
       : 'Contact us: Onyx AI answers your questions instantly about connection, Onyx Guardian, plans and funding; if needed, a person replies by email.');
  return { title: seo.title, description: seo.description, alternates: localeAlternates('/contacto') };
}

export default function ContactoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
