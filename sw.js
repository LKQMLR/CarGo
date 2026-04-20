const CACHE = 'cargo-v215';
const ASSETS = [
  './index.html', './manifest.json',
  './css/variables.css', './css/layout.css', './css/components.css',
  './css/deliveries.css', './css/navigation.css', './css/route.css',
  './css/premium.css',
  './js/auth.js', './js/app.js', './js/map.js', './js/geocoding.js',
  './js/deliveries.js', './js/optimizer.js', './js/route.js',
  './js/navigation.js', './js/simulation.js', './js/premium.js',
  './js/history.js', './js/lz-string.min.js',
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
  // Ne pas intercepter les POST ni les requêtes externes
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('googleapis.com') || e.request.url.includes('gstatic.com') || e.request.url.includes('googlesyndication.com') || e.request.url.includes('doubleclick.net') || e.request.url.includes('vercel.app') || e.request.url.includes('supabase.co') || e.request.url.includes('jsdelivr.net')) return;

  // Cache-first : réponse instantanée depuis le cache, mise à jour réseau en arrière-plan
  e.respondWith(
    caches.match(e.request).then(cached => {
      // Mettre à jour le cache en arrière-plan (stale-while-revalidate)
      const fetchPromise = fetch(e.request).then(r => {
        if (r.ok) {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return r;
      }).catch(() => cached);

      // Si en cache → réponse instantanée ; sinon → attendre le réseau
      return cached || fetchPromise;
    })
  );
});
