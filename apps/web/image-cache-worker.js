const imageCacheName = 'cdtank-images';

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin
      || request.cache === 'no-cache'
      || !/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(url.pathname)) return;
  event.respondWith(caches.open(imageCacheName).then(async cache => {
    const stored = await cache.match(request);
    return stored ?? fetch(request);
  }));
});
