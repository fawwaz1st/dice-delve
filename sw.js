/* ==========================================================================
   Ular Tangga Modern — sw.js (service worker)

   Strategi:
   - Navigasi + berkas kode (HTML/CSS/JS): NETWORK-FIRST. Versi baru langsung
     terpakai saat online, cache hanya jaring saat offline. Ini mencegah
     dokumen baru dipasangkan dengan skrip lama (version skew).
   - Gambar: cache-first dengan penyegaran di latar (jarang berubah).
   - Google Fonts: stale-while-revalidate.
   - Selalu ada Response cadangan: respondWith() tidak boleh menerima undefined.

   Catatan penting: caches.keys() berlingkup ORIGIN, bukan scope. Di GitHub
   Pages semua project page berbagi satu origin, jadi pembersihan cache WAJIB
   dibatasi ke prefiks milik aplikasi ini saja.
   ========================================================================== */

const VERSION = 'ulartangga-v3';
const CACHE_PREFIX = 'ulartangga-';

const PRECACHE = [
  'index.html',
  'views/menu.html',
  'views/game.html',
  'manifest.webmanifest',
  'assets/css/base.css',
  'assets/css/menu.css',
  'assets/css/game.css',
  'assets/js/core.js',
  'assets/js/icons.js',
  'assets/js/audio.js',
  'assets/js/confetti.js',
  'assets/js/skills.js',
  'assets/js/game.js',
  'assets/js/menu.js',
  'assets/images/favicon.ico',
  'assets/images/favicon.svg',
  'assets/images/icon-180.png',
  'assets/images/icon-192.png',
  'assets/images/icon-512.png',
  'assets/images/icon-maskable-512.png',
];

/* Berkas kode: tidak boleh disajikan basi, karena HTML dan JS harus sejalan. */
const CODE = /\.(?:html|css|js|webmanifest)$/i;

/** Response cadangan supaya offline tidak pernah gagal keras. */
function offlineResponse(kind) {
  if (kind === 'document') {
    return new Response(
      '<!DOCTYPE html><html lang="id"><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Ular Tangga Modern — offline</title>' +
      '<body style="margin:0;min-height:100vh;display:grid;place-items:center;' +
      'background:#4a2f1b;color:#f3e0bd;font:16px/1.5 system-ui,sans-serif;text-align:center">' +
      '<div><h1 style="font-size:1.4rem">Belum pernah dibuka online</h1>' +
      '<p>Halaman ini belum tersimpan di cache. Sambungkan internet sekali, lalu buka lagi.</p>' +
      '</div></body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
  return new Response('', { status: 504, statusText: 'Offline' });
}

/** Ambil dari cache sebagai cadangan terakhir, sesuai jenis request. */
function fromCache(request) {
  const isDocument = request.mode === 'navigate' || /\.html?$/.test(new URL(request.url).pathname);
  return caches.match(request).then((hit) => {
    if (hit) return hit;
    if (isDocument) {
      return caches.match('views/game.html')
        .then((fallback) => fallback || offlineResponse('document'));
    }
    // Aset: jangan kembalikan HTML untuk JS/CSS (MIME error).
    return caches.match(request).then((h) => h || offlineResponse('asset'));
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      // Satu file gagal tidak membatalkan install (addAll all-or-nothing).
      .then((cache) => Promise.all(
        PRECACHE.map((url) => cache.add(url).catch(() => {}))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // HANYA cache milik aplikasi ini; cache PWA lain di origin yang sama
      // (GitHub Pages berbagi origin antar project page) tidak boleh disentuh.
      .then((keys) => Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== VERSION)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  /* ---- Google Fonts: stale-while-revalidate ---------------------------- */
  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    event.respondWith(
      caches.match(event.request).then((hit) => {
        const refresh = fetch(event.request)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((cache) => cache.put(event.request, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => null);
        // Font boleh tampil dari cache lebih dulu; kalau tidak ada sama sekali,
        // kembalikan Response kosong alih-alih undefined.
        return hit || refresh.then((res) => res || new Response('', { status: 504 }));
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  /* ---- Navigasi & berkas kode: network-first --------------------------- */
  if (event.request.mode === 'navigate' || CODE.test(url.pathname)) {
    event.respondWith(
      // cache: 'reload' melewati HTTP cache yang bisa menyajikan versi lama.
      fetch(event.request, { cache: 'reload' })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(event.request, copy)).catch(() => {});
            return res;
          }
          // Respons non-ok (mis. 404 sementara): coba cache lama.
          return fromCache(event.request);
        })
        .catch(() => fromCache(event.request))
    );
    return;
  }

  /* ---- Gambar & aset lain: cache-first, segarkan di latar -------------- */
  event.respondWith(
    caches.match(event.request).then((hit) => {
      const refresh = fetch(event.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => null);

      // Selalu kembalikan sesuatu yang berupa Response.
      return hit || refresh.then((res) => res || offlineResponse('asset'));
    })
  );
});
