import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ARTICLES, bySlug, Lang } from '@/lib/guide';
import { getArticleServer } from '@/lib/guideStore';
import ArticleView from './ArticleView';
import JsonLd from '../../JsonLd';
import { serverLang, localeAlternates, SITE } from '@/lib/locale';

// Los del código se generan en el build (para Google). Los del dueño se
// resuelven bajo demanda: dynamicParams (por defecto true) permite slugs nuevos.
export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const a = (await getArticleServer(params.slug)) || bySlug(params.slug);
  if (!a) return { title: 'Guía de Onyx' };
  const lang: Lang = serverLang();
  const kws = a.seo?.keywords?.[lang];
  return {
    title: a.seo?.title?.[lang] || `${a.title[lang]} · Guía de Onyx`,
    description: a.seo?.desc?.[lang] || a.summary[lang],
    ...(kws && kws.length ? { keywords: kws } : {}),
    alternates: localeAlternates(`/guia/${a.slug}`),
  };
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const a = (await getArticleServer(params.slug)) || bySlug(params.slug);
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
