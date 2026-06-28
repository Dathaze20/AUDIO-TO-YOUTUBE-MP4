const CACHE_NAME = 'audio-to-youtube-mp4-v3';
const STATIC_ASSETS = [
  './',
  './index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache blob URLs (user media files)
  if (url.protocol === 'blob:') return;

  // Never cache large media uploads
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache same-origin, successful responses for app shell assets
        if (response.ok && url.origin === self.location.origin) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            // Don't cache media files users might select
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.startsWith('audio/') && !contentType.startsWith('video/')) {
              cache.put(event.request, responseClone);
            }
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
