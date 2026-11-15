/**
 * service-worker.js
 * =====================================================================
 * PWA Service Worker — Ruang Karya (Multi-Work Editorial Reader)
 *
 * Keamanan & Strategi Cache:
 *  • Network-only (TANPA CACHE) untuk:
 *      - Seluruh endpoint Supabase (Auth, REST drafts, Realtime, Storage upload/API)
 *      - Request dengan header Authorization / apikey
 *      - Rute /editor dan seluruh konten Studio admin terautentikasi
 *      - Dev server Vite (/@*, /src/*, /node_modules/*)
 *  • Cache-first untuk aset statis publik (preset audio, gambar, ikon)
 *  • Network-first untuk HTML reader publik & Google Fonts
 * =====================================================================
 */

const CACHE_NAME = 'ruang-karya-v5';
const FONTS_CACHE = 'ruang-karya-fonts-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-16.png',
  '/icons/icon-32.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable.png',
  '/asset/preview.jpg',
  '/audio/robbers.mp3',
  '/audio/breathe.mp3',
  '/audio/somebody.mp3',
  '/audio/cute.mp3',
  '/audio/about_you.mp3',
  '/audio/kota.mp3',
  '/audio/watchsleep.mp3',
  '/audio/default_1.mp3',
  '/audio/default_2.mp3',
];

function isSensitiveOrDynamicRequest(request, url) {
  if (request.headers.has('Authorization') || request.headers.has('apikey')) {
    return true;
  }

  if (
    url.hostname.endsWith('.supabase.co') ||
    url.hostname.endsWith('.supabase.in') ||
    url.pathname.startsWith('/auth/v1') ||
    url.pathname.startsWith('/rest/v1') ||
    url.pathname.startsWith('/realtime/v1') ||
    url.pathname.startsWith('/storage/v1')
  ) {
    return true;
  }

  if (url.pathname === '/editor' || url.pathname.startsWith('/editor/')) {
    return true;
  }

  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/')
  ) {
    return true;
  }

  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Gagal cache:', url, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== FONTS_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (isSensitiveOrDynamicRequest(request, url)) {
    return;
  }

  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const cloned = response.clone();
            caches.open(FONTS_CACHE).then((cache) => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', cloned));
          }
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
        return response;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
