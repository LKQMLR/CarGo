const CACHE = 'cargo-v102';
const ASSETS = [
  './index.html', './manifest.json',
  './css/variables.css', './css/layout.css', './css/components.css',
  './css/deliveries.css', './css/navigation.css', './css/route.css',
  './css/premium.css',
  './js/app.js', './js/map.js', './js/geocoding.js',
  './js/deliveries.js', './js/optimizer.js', './js/route.js',
  './js/navigation.js', './js/simulation.js', './js/premium.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('googleapis.com') || e.request.url.includes('gstatic.com') || e.request.url.includes('googlesyndication.com') || e.request.url.includes('doubleclick.net') || e.request.url.includes('vercel.app')) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const clone = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return r;
    }).catch(() => caches.match(e.request))
  );
});
