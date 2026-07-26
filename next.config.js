/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
<<<<<<< HEAD
    // Librerías con binarios nativos: Next NO debe empaquetarlas (se cargan en
    // tiempo de ejecución). Sin esto, el build falla al meter el archivo .node.
    serverComponentsExternalPackages: ['@napi-rs/canvas', 'sharp', 'pdf-lib'],
    // Asegura que las fuentes de la tarjeta de reporte viajen a las funciones serverless.
=======
    serverComponentsExternalPackages: ['@napi-rs/canvas', 'sharp', 'pdf-lib'],
>>>>>>> 499f248be7312457616bedc777052cd680b196c8
    outputFileTracingIncludes: {
      '/api/**': ['./assets/fonts/**'],
    },
  },
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
