const CACHE_NAME = 'cal-afrik-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Bypass Service Worker for API calls, Next.js internal requests, and Supabase
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.hostname.includes('supabase') ||
    e.request.method !== 'GET'
  ) {
    return;
  }

  // Network-first strategy: try to fetch from network, fallback to cache if offline
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Cache the valid response
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // If network fails (offline), return from cache
        return caches.match(e.request);
      })
  );
});
