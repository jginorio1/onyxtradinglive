/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No romper el deploy por errores de tipos/lint (MVP). Se pueden reactivar luego.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Librerías con binarios nativos: Next NO debe empaquetarlas (se cargan en
    // tiempo de ejecución). Sin esto, el build falla al meter el archivo .node.
    serverComponentsExternalPackages: ['@napi-rs/canvas', 'sharp', 'pdf-lib'],
    // Asegura que las fuentes de la tarjeta de reporte viajen a las funciones serverless.
    outputFileTracingIncludes: {
      '/api/**': ['./assets/fonts/**'],
    },
  },
  // Optimización: cachear fuerte lo que no cambia (imágenes, íconos, fuentes),
  // para que la segunda visita sea casi instantánea. El HTML sigue dinámico.
  async headers() {
    // Cabeceras de seguridad en TODAS las respuestas (anti-clickjacking, MIME
    // sniffing, forzar HTTPS, limitar permisos del navegador). Sin CSP estricta
    // para no romper Stripe/embeds; el resto son seguras y de alto valor.
    const security = [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
      { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
    ];
    return [
      { source: '/:path*', headers: security },
      {
        source: '/:all*(png|jpg|jpeg|gif|svg|webp|avif|ico|woff|woff2|ttf|otf|mp4)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};
module.exports = nextConfig;
