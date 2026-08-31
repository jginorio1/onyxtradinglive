import type { MetadataRoute } from 'next';

// robots.txt: deja entrar a los buscadores a lo público y les cierra lo privado.
const url = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.onyxtradinglive.com').replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/admin', '/account', '/onboarding', '/api', '/auth'],
      },
    ],
    sitemap: `${url}/sitemap.xml`,
    host: url,
  };
}
