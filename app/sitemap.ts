import type { MetadataRoute } from 'next';
import { ARTICLES } from '@/lib/guide';

// Sitemap: le dice a Google qué páginas existen para que las descubra rápido.
const url = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPaths: { p: string; pr: number; f: 'weekly' | 'monthly' }[] = [
    { p: '', pr: 1, f: 'weekly' },
    { p: '/pricing', pr: 0.9, f: 'weekly' },
    { p: '/embajadores', pr: 0.7, f: 'monthly' },
    { p: '/guia', pr: 0.8, f: 'weekly' },
    { p: '/login', pr: 0.5, f: 'monthly' },
    { p: '/terms', pr: 0.3, f: 'yearly' as any },
  ];
  const pages = staticPaths.map((s) => ({
    url: `${url}${s.p}`, lastModified: now, changeFrequency: s.f, priority: s.pr,
    alternates: { languages: { es: `${url}${s.p}`, en: `${url}/en${s.p}` } },
  }));
  const articles = ARTICLES.map((a) => ({
    url: `${url}/guia/${a.slug}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.6,
    alternates: { languages: { es: `${url}/guia/${a.slug}`, en: `${url}/en/guia/${a.slug}` } },
  }));
  return [...pages, ...articles];
}
