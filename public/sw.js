// Service worker de Onyx (PWA).
// Estrategia conservadora para una app con sesión:
//  - Nunca cachea /api ni peticiones que no sean GET (datos siempre frescos).
//  - Navegaciones: red primero; si no hay internet, muestra /offline.html.
//  - Estáticos (_next/static, íconos, imágenes): se sirven de caché y se
//    actualizan en segundo plano (stale-while-revalidate).
const VERSION = 'onyx-v1';
const SHELL = ['/offline.html', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api')) return;   // datos: siempre a la red

  // Navegaciones (abrir una página): red primero, fallback offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // Estáticos: stale-while-revalidate.
  if (url.pathname.startsWith('/_next/static') || /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const cached = await cache.match(req);
        const fetching = fetch(req).then((res) => { if (res && res.status === 200) cache.put(req, res.clone()); return res; }).catch(() => cached);
        return cached || fetching;
      })
    );
  }
});
