const CACHE_NAME = 'gutbuddy-v2';
const CACHE_MAX_ENTRIES = 60;

// Assets to cache on install
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
];

// Install: precache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean old caches + trim any overgrown cache from previous sessions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      // Proactive sweep: trim if cache grew past the limit before this version activated
      const cache = await caches.open(CACHE_NAME);
      const entries = await cache.keys();
      if (entries.length > CACHE_MAX_ENTRIES) {
        for (const key of entries.slice(0, entries.length - CACHE_MAX_ENTRIES)) {
          await cache.delete(key);
        }
      }
    })()
  );
  self.clients.claim();
});

// Fetch: stale-while-revalidate for navigation, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and API requests (always go to network)
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // For navigation requests: stale-while-revalidate so the app shell is never stale
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        // Always revalidate in the background so the next visit gets fresh HTML
        const revalidation = fetch(request).then((fresh) => {
          cache.put(request, fresh.clone());
          return fresh;
        });
        if (cached) {
          // Serve stale immediately; background fetch updates cache for next visit
          event.waitUntil(revalidation);
          return cached;
        }
        // Nothing cached yet — wait for network, fall back to '/' or 503
        try {
          return await revalidation;
        } catch {
          return (await cache.match('/')) || new Response('Offline', { status: 503 });
        }
      })()
    );
    return;
  }

  // For static assets: cache-first with network fallback + bounded FIFO eviction
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        // Await put before counting keys so concurrent requests can't exceed the limit
        await cache.put(request, response.clone());
        const keys = await cache.keys();
        if (keys.length > CACHE_MAX_ENTRIES) {
          await cache.delete(keys[0]);
        }
      }
      return response;
    })()
  );
});
