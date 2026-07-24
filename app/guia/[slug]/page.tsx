import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ARTICLES, bySlug, Lang } from '@/lib/guide';
import ArticleView from './ArticleView';
import JsonLd from '../../JsonLd';
import { serverLang, localeAlternates, SITE } from '@/lib/locale';

// Se generan en el build para que Google las lea sin ejecutar nada
export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const a = bySlug(params.slug);
  if (!a) return { title: 'Guía de Onyx' };
  const lang: Lang = serverLang();
  return {
    title: `${a.title[lang]} · Guía de Onyx`,
    description: a.summary[lang],
    alternates: localeAlternates(`/guia/${a.slug}`),
  };
}

export default function ArticlePage({ params }: { params: { slug: string } }) {
  const a = bySlug(params.slug);
  if (!a) notFound();
  const art = a!;
  const lang: Lang = serverLang();
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: art.title[lang], description: art.summary[lang], inLanguage: lang,
    mainEntityOfPage: `${SITE}/guia/${art.slug}`,
    author: { '@type': 'Organization', name: 'Onyx Trading Live' },
    publisher: { '@type': 'Organization', name: 'Onyx Trading Live', logo: { '@type': 'ImageObject', url: `${SITE}/onyx-symbol.png` } },
  };
  return <><JsonLd data={ld} /><ArticleView slug={params.slug} /></>;
}
