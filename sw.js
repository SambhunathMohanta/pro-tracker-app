const CACHE_NAME = 'pro-tracker-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  clients.claim();
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)
    ))
  );
});

self.addEventListener('fetch', (e) => {
  // Try network, fallback to cache for dynamic firebase requests if offline
  if (e.request.url.startsWith(self.location.origin)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          // put new GET responses into cache (optional)
          if (e.request.method === 'GET') {
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, resp.clone()));
          }
          return resp;
        }).catch(()=> caches.match('/index.html'));
      })
    );
  } else {
    // for external requests just try network then cache
    e.respondWith(fetch(e.request).catch(()=> caches.match('/index.html')));
  }
});
