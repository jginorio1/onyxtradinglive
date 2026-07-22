import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { ARTICLES, bySlug, Lang } from '@/lib/guide';
import ArticleView from './ArticleView';

// Se generan en el build para que Google las lea sin ejecutar nada
export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const a = bySlug(params.slug);
  if (!a) return { title: 'Guía de Onyx' };
  const lang: Lang = (cookies().get('onyx_lang')?.value === 'en' ? 'en' : 'es');
  return {
    title: `${a.title[lang]} · Guía de Onyx`,
    description: a.summary[lang],
  };
}

export default function ArticlePage({ params }: { params: { slug: string } }) {
  if (!bySlug(params.slug)) notFound();
  return <ArticleView slug={params.slug} />;
}
