const CACHE_NAME = 'sonicstream-cache-v27';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css?v=10.0',
  '/app.js?v=10.2',
  '/default-cover.svg',
  '/icon.png',
  '/register-sw.js?v=1.0',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap'
];

// Install Event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.all(ASSETS_TO_CACHE.map(async asset => {
        try {
          const response = await fetch(asset, { cache: 'no-cache' });
          if (response.ok || response.type === 'opaque') await cache.put(asset, response);
        } catch (error) {
          console.warn('Unable to cache asset:', asset, error);
        }
      }));
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', event => {
  // Ignore API requests and media streaming requests
  if (event.request.url.includes('/api/')) return;
  
  const requestUrl = new URL(event.request.url);
  if (requestUrl.pathname === '/' || requestUrl.pathname.endsWith('/index.html')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request)));
    return;
  }

  event.respondWith(caches.match(event.request).then(cachedResponse => {
    if (cachedResponse) return cachedResponse;
    return fetch(event.request).then(fetchResponse => {
      if (fetchResponse.ok && event.request.method === 'GET' && !fetchResponse.type.includes('opaque')) {
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, fetchResponse.clone())));
      }
      return fetchResponse;
    });
  }));
});
