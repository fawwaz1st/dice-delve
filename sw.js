/* ==========================================================================
   Ular Tangga Modern — sw.js (service worker)
   Precache seluruh aset lokal saat install, cache-first dengan pembaruan
   di latar untuk permintaan same-origin, dan stale-while-revalidate untuk
   Google Fonts. Naikkan VERSION untuk memaksa cache lama dibuang.
   ========================================================================== */

const VERSION = 'ulartangga-v2';

const PRECACHE = [
  './',
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
  'assets/images/icon-192.png',
  'assets/images/icon-512.png',
  'assets/images/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (url.origin === self.location.origin) {
    // Navigasi (dokumen HTML): network-first. Versi terbaru langsung terlihat
    // saat online, dan cache hanya dipakai sebagai jaring saat offline.
    if (event.request.mode === 'navigate') {
      event.respondWith(
        fetch(event.request)
          .then((res) => {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(event.request, copy)).catch(() => {});
            return res;
          })
          .catch(() => caches.match(event.request).then((hit) => hit || caches.match('views/game.html')))
      );
      return;
    }

    // Aset statis (CSS/JS/ikon): cache-first, segarkan cache di latar.
    event.respondWith(
      caches.match(event.request).then((hit) => {
        const refresh = fetch(event.request)
          .then((res) => {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(event.request, copy)).catch(() => {});
            return res;
          })
          .catch(() => hit);
        return hit || refresh;
      })
    );
    return;
  }

  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    // Stale-while-revalidate: font tampil instan, diperbarui di belakang.
    event.respondWith(
      caches.match(event.request).then((hit) => {
        const refresh = fetch(event.request)
          .then((res) => {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(event.request, copy)).catch(() => {});
            return res;
          })
          .catch(() => hit);
        return hit || refresh;
      })
    );
  }
});
