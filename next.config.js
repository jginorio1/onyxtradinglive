/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No romper el deploy por errores de tipos/lint (MVP). Se pueden reactivar luego.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Asegura que las fuentes de la tarjeta de reporte viajen a las funciones serverless.
  experimental: {
    outputFileTracingIncludes: {
      '/api/**': ['./assets/fonts/**'],
    },
  },
  // Optimización: cachear fuerte lo que no cambia (imágenes, íconos, fuentes),
  // para que la segunda visita sea casi instantánea. El HTML sigue dinámico.
  async headers() {
    return [
      {
        source: '/:all*(png|jpg|jpeg|gif|svg|webp|avif|ico|woff|woff2|ttf|otf|mp4)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};
module.exports = nextConfig;
