const CACHE_NAME = 'it-support-v1.2';
const STATIC_ASSETS = [
  './',
  'Index.html',
  'dashboard.html',
  'style.css',
  'app.js',
  'dashboard.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // เก็บทีละไฟล์: ถ้าไฟล์ใดไม่มี (เช่น manifest.json / icon) ก็ไม่ทำให้ไฟล์อื่นพลอยไม่ถูกแคช
      // (cache.addAll ล้มทั้งชุดถ้ามีไฟล์เดียวโหลดไม่ได้)
      return Promise.all(STATIC_ASSETS.map(asset => {
        const isCrossOrigin = /^https?:/i.test(asset) && new URL(asset).origin !== self.location.origin;
        const req = isCrossOrigin ? new Request(asset, { mode: 'no-cors' }) : asset;
        return cache.add(req).catch(err => console.warn('Pre-cache skipped:', asset, err && err.message));
      }));
    })
  );
  self.skipWaiting();
});

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

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && (response.status === 200 || response.type === 'opaque') && event.request.method === 'GET') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('Index.html');
          }
        });
      })
  );
});