const cacheName = 'expo-leads-cache-v7';
const filesToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/sivaprints.png',
  '/export.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(cacheName).then(cache => cache.addAll(filesToCache))
  );
});
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then(response => response || new Response('', { status: 404 }))
    )
  );
});