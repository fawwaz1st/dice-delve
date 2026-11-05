const CACHE = 'dice-delve-v1';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Aset Vite (hash) + navigasi: network-first, lalu cache.
  const isAsset = /\/assets\//.test(url.pathname) || url.pathname.endsWith('.js') || url.pathname.endsWith('.css');
  if (isAsset || request.mode === 'navigate') {
    e.respondWith(
      fetch(request, { cache: 'reload' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html'))),
    );
    return;
  }
  // Font CDN: cache-first.
  e.respondWith(
    caches.match(request).then((hit) => hit || fetch(request)),
  );
});
