const CACHE = 'cargo-v231';
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

// ── NOTIFICATIONS DE NAVIGATION ──
let _navNotifTimer = null;

self.addEventListener('message', e => {
  if (!e.data) return;
  if (e.data.type === 'SCHEDULE_NAV_NOTIFICATION') {
    if (_navNotifTimer) clearTimeout(_navNotifTimer);
    const { delay, address, num } = e.data;
    _navNotifTimer = setTimeout(() => {
      self.registration.showNotification('CarGo · Livraison ' + num, {
        body: 'Êtes-vous arrivé à ' + address + ' ?',
        icon: './icon.svg',
        badge: './icon.svg',
        tag: 'cargo-nav',
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        actions: [
          { action: 'return', title: '✓ Retour CarGo' },
          { action: 'dismiss', title: 'Pas encore' }
        ]
      });
    }, delay);
  }
  if (e.data.type === 'CANCEL_NAV_NOTIFICATION') {
    if (_navNotifTimer) { clearTimeout(_navNotifTimer); _navNotifTimer = null; }
    self.registration.getNotifications({ tag: 'cargo-nav' }).then(ns => ns.forEach(n => n.close()));
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin)) return c.focus();
      }
      return clients.openWindow('./');
    })
  );
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
