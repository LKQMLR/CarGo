# CarGo — Guide de reconstruction (pour Claude tuteur)

> **Ce fichier est la bible du projet pour Claude dans un nouveau dossier.**
> L'utilisateur veut reconstruire CarGo lui-même, guidé par Claude étape par étape.
> Claude ne génère pas tout le projet en une fois — il guide, explique, puis laisse l'utilisateur implémenter.
> L'utilisateur parle **français** — toujours répondre en français.

---

## Ce qu'est CarGo

CarGo est une **application mobile** de gestion et d'optimisation de tournées de livraison.
Un livreur entre ses adresses, l'app calcule l'ordre optimal, trace le trajet, et guide en navigation GPS.

**Stack : Vanilla JS / HTML / CSS — aucun framework, aucun bundler.**
API backend sur **Vercel** (Node.js serverless).

### Objectif final : une vraie app distribuée sur les stores

CarGo n'est pas qu'un site web — l'objectif est de la distribuer sur **Google Play Store** et **Apple App Store** comme une application native. La technologie choisie pour ça est **Capacitor** (de l'équipe Ionic) : il encapsule le code web dans une coque native iOS/Android sans changer une ligne de JS/HTML/CSS.

**Cela se fait en toute dernière phase**, une fois que l'application est complète et stable. Tout le développement se fait d'abord dans le navigateur.

Le parcours complet du projet :
1. Développement local → **Live Server** (VS Code)
2. Mise en ligne web → **GitHub Pages** (partage facile, test sur mobile)
3. Distribution native → **Capacitor** → Google Play + App Store

---

## Un seul dossier, un seul repo

Tout le projet est dans **un seul dossier Git** :

```
CarGo/
├── index.html
├── manifest.json
├── sw.js
├── vercel.json
├── package.json      ← dépendances Capacitor + Stripe
├── css/
├── js/
└── api/              ← fonctions serverless Node.js (Vercel les détecte automatiquement)
    ├── check-subscription.js
    ├── create-checkout.js
    ├── customer-portal.js
    └── cancel-subscription.js
```

**Pourquoi `api/` est quand même un dossier séparé dans le projet** : le frontend (HTML/CSS/JS) ne peut pas contenir les clés secrètes Stripe — n'importe qui pourrait les lire dans le navigateur. Ces clés doivent rester sur un serveur. Vercel détecte automatiquement le dossier `api/` et déploie chaque fichier `.js` comme une fonction serverless indépendante. Le frontend l'appelle via `fetch()`.

**Référence au projet actuel** : le projet `livreurGPS` existant était divisé en deux repos (`livreurGPS` + `cargo-api`) uniquement parce qu'il était hébergé sur GitHub Pages (qui n'accepte que du statique). Ce n'est pas la bonne approche pour un vrai projet — dans la reconstruction, tout sera dans un seul repo.

---

## Rôle de Claude dans ce projet

Claude est un **tuteur technique**, pas un générateur de code.

### Ce que Claude DOIT faire
- Guider **une étape à la fois**, dans l'ordre des phases définies plus bas
- Expliquer le **pourquoi** de chaque concept avant de donner le code
- Donner du code **progressif** : d'abord le squelette, puis les détails
- Vérifier que chaque étape fonctionne avant de passer à la suivante
- Indiquer exactement **quel fichier créer/modifier, quelle ligne, quelle fonction**
- Si l'utilisateur est bloqué : donner un exemple minimal, puis laisser adapter
- Rappeler l'état actuel ("on vient de faire X, maintenant on va faire Y")

### Ce que Claude NE DOIT PAS faire
- Générer tout un fichier de 300 lignes d'un coup
- Sauter des étapes "parce que c'est simple"
- Présupposer que l'utilisateur connaît un concept sans l'avoir expliqué
- Déployer sur Vercel lui-même — l'utilisateur déclenche tous les déploiements

---

## Priorité absolue : voir les changements en direct dès le départ

**Avant d'écrire une seule ligne de code applicatif**, l'environnement de développement doit être opérationnel. Claude doit guider ceci en tout premier.

### Étape 0 — Environnement de développement

**0.1 — Live Server (VS Code)**

L'outil de développement principal est l'extension **Live Server** de VS Code (auteur : Ritwick Dey).
- Installer depuis les extensions VS Code
- Créer le dossier du projet, l'ouvrir dans VS Code
- Créer `index.html` avec juste `<h1>CarGo</h1>`
- Clic droit sur `index.html` → **"Open with Live Server"**
- Le navigateur s'ouvre sur `http://127.0.0.1:5500/` et se recharge automatiquement à chaque sauvegarde

**Chaque `Ctrl+S` rafraîchit le navigateur instantanément.** C'est l'environnement de travail pendant tout le développement.

**0.2 — Structure minimale de départ**
```
CarGo/
├── index.html      ← <h1>CarGo</h1> pour vérifier que Live Server fonctionne
├── css/
│   └── variables.css
└── js/
    └── app.js
```

**0.3 — Git + GitHub (à faire dès le début, pas à la fin)**
```bash
git init
git add .
git commit -m "init"
# Créer le repo sur GitHub puis :
git remote add origin https://github.com/<username>/CarGo.git
git push -u origin main
```

**0.4 — GitHub Pages (optionnel pendant le dev, obligatoire avant Capacitor)**
Activer dans Settings → Pages → Source : `main` branch.
Permet de tester l'app sur mobile réel via `https://<username>.github.io/CarGo/`
avant de packager en app native.

> **Règle** : Live Server pour le développement quotidien. GitHub Pages pour les tests sur mobile et la mise en ligne web publique. Stores pour la distribution finale.

---

## Ordre de reconstruction — les 11 phases

Claude suit cet ordre **strictement**. Ne pas anticiper les phases suivantes.

---

### Phase 1 — Structure HTML et CSS de base

**Objectif** : avoir la sidebar + la carte visible dans le navigateur.

**Fichiers à créer dans cet ordre :**

**1.1 — `css/variables.css`** (couleurs, typographie, layout vars)
```css
:root {
  --bg: #141a24;
  --surface: #1b2432;
  --surface2: #1e2a3a;
  --surface3: #243045;
  --border: rgba(255,255,255,0.07);
  --accent: #4f8cff;
  --accent2: #6c63ff;
  --green: #22c55e;
  --yellow: #fbbf24;
  --orange: #f59e0b;
  --red: #ef4444;
  --text: #e2e8f0;
  --text2: #94a3b8;
  --text3: #64748b;
  --s1: #3b82f6;
  --s2: #0d9488;
  --s3: #d97706;
  --s4: #db2777;
  --s5: #7c3aed;
  --sidebar-w: 400px;
  --radius: 10px;
  --radius-sm: 8px;
}
```

**1.2 — `css/layout.css`** (sidebar fixe gauche 400px, carte droite)
- Sur desktop : sidebar `position: fixed; left:0; width: var(--sidebar-w); height: 100vh`
- La carte prend tout le reste : `margin-left: var(--sidebar-w); height: 100vh`
- Sur mobile (`max-width: 768px`) : sidebar en bas, carte plein écran

**1.3 — `index.html`** — structure de base
```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>CarGo</title>
  <link rel="stylesheet" href="css/variables.css">
  <link rel="stylesheet" href="css/layout.css">
  <link rel="stylesheet" href="css/components.css">
  <!-- ... autres CSS -->
  <link rel="manifest" href="manifest.json">
</head>
<body>
  <div id="sidebar">
    <div id="header"><!-- logo, version, boutons --></div>
    <div id="input-zone"><!-- champ adresse de départ, bouton ajouter --></div>
    <div id="delivery-list"><!-- liste des livraisons --></div>
    <div id="action-bar"><!-- bouton optimiser, démarrer nav --></div>
  </div>
  <div id="map"></div>
  <script src="js/app.js"></script>
  <!-- Google Maps chargé en dernier via callback -->
  <script src="https://maps.googleapis.com/maps/api/js?key=VOTRE_CLE&libraries=places&callback=initApp" async defer></script>
</body>
</html>
```

> **Checkpoint Phase 1** : sauvegarder, voir dans Live Server la sidebar sombre à gauche et la zone carte à droite (même vide).

---

### Phase 2 — Google Maps + State global

**Objectif** : afficher une vraie carte Google Maps dans `#map`.

**2.1 — `js/app.js`** — state global et `initApp()`

Le state global est un objet unique partagé par tous les modules :
```javascript
const state = {
  map: null,
  geocoder: null,
  directionsService: null,
  directionsRenderer: null,
  startPoint: null,       // { address, lat, lng, formatted, marker }
  deliveries: [],         // tableau d'objets livraison
  markers: [],
  navStops: null,
  navLegs: null,
  navIndex: 0,
  watchId: null,
  posMarker: null,
  posCircle: null,
  followMode: true,
  wakeLock: null,
  previewMap: null,
  previewMarkers: [],
  _routePoly: null,
  _routePolyGlow: null,
  _routePolyPreview: null,
  _routeLabels: [],
  _routeBounds: null,
  _completedPoly: null,
  _originalOrder: null,
};

let idCounter = 0;

function initApp() {
  state.map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 48.8566, lng: 2.3522 },
    zoom: 12,
    disableDefaultUI: true,
    gestureHandling: 'greedy',
    styles: [ /* voir Phase 2 détails */ ],
  });
  state.geocoder = new google.maps.Geocoder();
  state.directionsService = new google.maps.DirectionsService();
  // ... initialiser les autres modules
}
```

**Important** : `initApp` est le callback de Google Maps (`&callback=initApp`). Elle ne s'exécute qu'après que Maps soit complètement chargé. **Ne jamais appeler du code Maps en dehors de ce callback ou d'une fonction appelée par lui.**

**2.2 — Clé Google Maps**
- Aller sur Google Cloud Console → créer une clé API
- Restreindre aux APIs : Maps JavaScript, Geocoding, Directions, Places
- **Pendant le développement** : ne pas restreindre les referrers (ou ajouter `http://127.0.0.1:5500/*` pour Live Server)
- **Avant la mise en ligne** : restreindre aux referrers de production (`https://<username>.vercel.app/*` ou domaine custom)
- Ne jamais commit la clé dans le code — la mettre dans une variable ou la charger depuis un fichier ignoré par git

> **Checkpoint Phase 2** : sauvegarder, voir la carte Google Maps dans Live Server.

---

### Phase 3 — Marqueurs SVG et geocoding

**Objectif** : saisir une adresse, voir un marqueur apparaître sur la carte.

**3.1 — `js/map.js`** — marqueurs SVG custom

Les marqueurs sont des SVG inline (pas les pins Google par défaut) :
```javascript
function createClassicMarker(pos, label, color, title, map = state.map, opacity = 1) {
  const width = label.length > 1 ? 44 : 32;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="42" viewBox="0 0 ${width} 42">
    <rect x="1" y="1" width="${width-2}" height="28" rx="8" fill="${color}" stroke="white" stroke-width="1.5"/>
    <polygon points="${width/2-6},29 ${width/2+6},29 ${width/2},40" fill="${color}"/>
    <text x="${width/2}" y="19" text-anchor="middle" fill="white" font-family="system-ui" font-weight="700" font-size="13">${label}</text>
  </svg>`;
  return new google.maps.Marker({
    position: pos, map,
    icon: { url: 'data:image/svg+xml,' + encodeURIComponent(svg), anchor: new google.maps.Point(width/2, 42) },
    title, opacity,
  });
}
```

Couleurs selon secteur :
- Départ : `#22c55e` (vert), label `"D"`
- Secteur 0 (défaut) : `#8896a7` (gris)
- Secteurs 1-5 : `--s1` à `--s5` (bleu, teal, orange, rose, violet)

**3.2 — `js/geocoding.js`** — autocomplete Google Places

```javascript
let _autocomplete = null;

function initAutocomplete(inputId) {
  const input = document.getElementById(inputId);
  _autocomplete = new google.maps.places.Autocomplete(input, {
    fields: ['formatted_address', 'geometry', 'name'],
  });
  _autocomplete.addListener('place_changed', () => {
    const place = _autocomplete.getPlace();
    if (!place.geometry) return;
    // extraire lat/lng, appeler addDelivery()
  });
}
```

Appeler `initAutocomplete()` depuis `initApp()` après initialisation Maps.

**Structure du champ d'ajout d'adresse** (`delivery-input`) :

Le champ a trois éléments dans un `input-wrapper` :
- **Bouton étoile à gauche** : clic → ouvre le dropdown favoris/récents (`showFreqDropdown`)
- **Input texte** : padding-left et padding-right ajustés pour les deux boutons
- **Croix en cercle à droite** : visible uniquement quand le champ a du texte, vide le champ

```html
<div class="input-wrapper delivery-input-wrapper">
  <button class="input-fav-btn" onclick="showFreqDropdown('delivery-input','freq-delivery')"><!-- étoile SVG --></button>
  <input type="text" id="delivery-input" placeholder="Ajouter une adresse..." />
  <button class="input-clear-btn" id="delivery-clear" onclick="clearDeliveryInput()" style="display:none"><!-- × SVG --></button>
  <div class="freq-dropdown" id="freq-delivery"></div>
</div>
```

```javascript
function clearDeliveryInput() {
  const input = document.getElementById('delivery-input');
  input.value = '';
  input.dataset.lat = ''; input.dataset.lng = '';
  input.dataset.formatted = ''; input.dataset.resolved = '';
  _updateDeliveryClear();
  input.focus();
}
function _updateDeliveryClear() {
  const btn = document.getElementById('delivery-clear');
  const input = document.getElementById('delivery-input');
  if (btn) btn.style.display = input.value.trim() ? 'flex' : 'none';
}
```

**Favoris dans le dropdown** : `showFreqDropdown` affiche les favoris **pour tous les champs** (pas seulement le champ départ). Le dropdown trie : favoris en haut (étoile pleine), récents en dessous (étoile vide).

**Modèle d'une livraison** :
```javascript
{
  id: idCounter++,
  address: "12 rue de la Paix",
  lat: 48.8698,
  lng: 2.3311,
  formatted: "12 Rue de la Paix, 75001 Paris",
  note: "",
  sector: 0,      // 0 = défaut, 1-5 = secteurs colorés
  locked: false,
  marker: null,   // référence google.maps.Marker
  legDist: null,  // "1,2 km" — rempli après optimisation
  legDur: null,   // "4 min" — rempli après optimisation
}
```

> **Checkpoint Phase 3** : saisir une adresse → marqueur apparaît sur la carte.

---

### Phase 4 — Liste des livraisons

**Objectif** : voir la liste, pouvoir réordonner, supprimer, modifier.

**4.1 — `js/deliveries.js`**

Fonctions principales :
- `renderDeliveries()` — reconstruit le DOM de la liste depuis `state.deliveries`
- `addDelivery(address, lat, lng, formatted)` — ajoute au tableau + marqueur
- `removeDelivery(id)` — retire du tableau + supprime le marqueur de la carte
- `updateDeliveryNote(id, note)` — met à jour la note
- `updateDeliverySector(id, sector)` — change le secteur + recolore le marqueur

**Drag & drop** pour réordonner :
```javascript
// Attributs HTML sur chaque <li> :
// draggable="true" data-id="${d.id}"
// Événements : dragstart, dragover, drop
// À la fin du drop : reconstruire state.deliveries selon l'ordre du DOM
```

**Swipe gauche mobile** pour supprimer :
- `touchstart` / `touchmove` / `touchend`
- Si déplacement X > 80px vers la gauche : afficher bouton "Supprimer" rouge

**Double-tap mobile** pour changer le secteur :
- Détecter deux `touchend` en moins de 300ms sur le même élément
- Incrémenter `sector` de 0 à 5, puis revenir à 0

**4.2 — `css/deliveries.css`** — style de la liste

> **Checkpoint Phase 4** : ajouter 3 adresses, les réordonner par drag, en supprimer une.

---

### Phase 5 — Optimisation et tracé du trajet

**Objectif** : bouton "Optimiser" → l'ordre se recalcule + le trajet s'affiche.

**5.1 — `js/optimizer.js`** — algorithme TSP local

**Ordre d'exécution** :
1. Séparer les stops `locked: true` (ils gardent leur position absolue)
2. Regrouper les stops non-lockés par secteur (secteur 0 = traités en dernier)
3. Sur chaque groupe : appliquer **Nearest Neighbor**
4. Appliquer **2-opt** pour améliorer
5. Réinsérer les stops lockés à leurs positions d'origine
6. Appeler Google Directions avec `optimizeWaypoints: false` (l'ordre est déjà calculé)

**Nearest Neighbor** :
```javascript
function nearestNeighbor(stops) {
  const unvisited = [...stops];
  const result = [unvisited.shift()];
  while (unvisited.length) {
    const last = result[result.length - 1];
    let minDist = Infinity, minIdx = 0;
    unvisited.forEach((s, i) => {
      const d = haversine(last, s);
      if (d < minDist) { minDist = d; minIdx = i; }
    });
    result.push(unvisited.splice(minIdx, 1)[0]);
  }
  return result;
}
```

**Haversine** (distance à vol d'oiseau en km) :
```javascript
function haversine(a, b) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}
```

**Limite Google Directions** : max 23 waypoints par requête. Si plus de 23 stops, faire du **batching** : diviser en lots de 23 avec chevauchement du dernier stop (point de départ du lot suivant).

**5.2 — `js/route.js`** — affichage du trajet

- Dessiner la polyline du trajet (couleur `--accent`, épaisseur 5)
- Dessiner un "glow" par-dessous (même path, couleur `#4f8cff`, épaisseur 16, opacité 0.12)
- Renuméroter les marqueurs selon l'ordre optimisé
- Calculer et afficher la distance et durée totale
- Afficher une carte aperçu mobile (180px de haut, `tilt: 0`, styles épurés)

**Styles de la carte aperçu** (routes locales masquées, fond neutre) :
```javascript
styles: [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.local', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f2f2f2' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d4eaf5' }] },
]
```

**FitBounds sur le trajet** — utiliser `addListenerOnce('idle', ...)` pour garantir que le zoom se fait après le rendu :
```javascript
google.maps.event.addListenerOnce(state.previewMap, 'idle', () => {
  state.previewMap.fitBounds(bounds, 20);
});
state.previewMap.fitBounds(bounds, 20);
```

**IMPORTANT** — `google.maps.OverlayView` : ne jamais en hériter au niveau global du fichier. Utiliser une **factory function** appelée uniquement après que Maps soit chargé :
```javascript
// ✗ FAUX — crashe avant que Maps soit chargé
class MyOverlay extends google.maps.OverlayView { ... }

// ✓ CORRECT — factory function
function makeMyOverlay(...) {
  class _Overlay extends google.maps.OverlayView { ... }
  return new _Overlay(...);
}
```

> **Checkpoint Phase 5** : ajouter 5 adresses, cliquer "Optimiser", voir la polyline bleue sur la carte.

---

### Phase 6 — Navigation GPS

**Objectif** : mode navigation pas-à-pas avec position en temps réel.

**`js/navigation.js`** — fonctions clés

```javascript
function startNavigation() {
  // 1. Vérifier que state.navStops existe
  // 2. Demander la géolocalisation : navigator.geolocation.watchPosition(updateGPS, onGPSError, { enableHighAccuracy: true })
  // 3. Activer le Wake Lock (empêche l'écran de s'éteindre)
  // 4. Afficher le panneau de navigation
}

function updateGPS(position) {
  const { latitude: lat, longitude: lng, accuracy } = position.coords;
  // Mettre à jour le marqueur de position
  // Si followMode : recentrer la carte sur la position
  // Calculer la distance au prochain stop
  // Si distance < 80m : marquer le stop comme arrivé
  // Si premium et distance < 150m d'un autre stop : alerte de proximité
}
```

**Wake Lock** (empêche l'écran de s'éteindre en navigation) :
```javascript
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      state.wakeLock = await navigator.wakeLock.request('screen');
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
          state.wakeLock = await navigator.wakeLock.request('screen');
        }
      });
    } catch (e) { /* Wake Lock non supporté, ignorer */ }
  }
}
```

**Ouverture dans Google Maps** :
```javascript
function openInGoogleMaps(stop) {
  const url = `https://maps.google.com/?daddr=${stop.lat},${stop.lng}&travelmode=driving`;
  window.open(url, '_blank');
}
```

> **Checkpoint Phase 6** : démarrer la navigation, voir le point GPS se déplacer.

---

### Phase 7 — Historique et partage de route

**`js/history.js`**

Persistence en localStorage (`cargo_history`, max 20 entrées) :
```javascript
{
  id: Date.now(),
  date: new Date().toISOString(),
  stops: [...state.deliveries], // copie profonde
  totalDist: "14,2 km",
  totalDur: "45 min",
  compressed: null // LZ-String si partagé
}
```

**Partage via URL** (compression LZ-String) :
```javascript
const data = {
  s: { a: start.address, la: start.lat, ln: start.lng, f: start.formatted },
  d: deliveries.map(d => ({ a: d.address, la: d.lat, ln: d.lng, f: d.formatted, n: d.note, s: d.sector, l: d.locked ? 1 : 0 }))
};
const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(data));
const url = `${location.origin}${location.pathname}?route=${compressed}`;
```

**`js/lz-string.min.js`** : copier le fichier minifié depuis `https://github.com/pieroxy/lz-string` (fichier `libs/lz-string.min.js`).

**Clés localStorage** utilisées dans tout le projet :
```
'cargo_session'     ← état en cours (startPoint, deliveries, navIndex, navStops)
'cargo_startPoint'  ← adresse de départ mémorisée entre les sessions
'cargo_freqAddr'    ← [{ address, lat, lng, count }] max 50 — adresses fréquentes
'cargo_favorites'   ← [{ address, lat, lng, label }] — favoris
'cargo_history'     ← [{ id, date, stops, totalDist, totalDur }] max 20
'cargo_mapPrefs'    ← { zoom, center }
'cargo_mapTypeId'   ← 'roadmap' | 'satellite' | 'hybrid'
```

---

### Phase 8 — Authentification Supabase

**Objectif** : créer un compte, se connecter, persister la session.

**8.1 — Créer le projet Supabase**
1. Aller sur `supabase.com` → New project
2. Récupérer : `URL` et `anon key` (dans Settings → API)
3. Créer la table `profiles` :

```sql
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

**8.2 — `js/auth.js`**

Charger le SDK Supabase via CDN dans `index.html` :
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

Initialisation :
```javascript
const _supabase = supabase.createClient('https://xxx.supabase.co', 'anon-key');
let _authUser = null;

function getAuthUser() { return _authUser; }
async function getAuthToken() {
  const { data } = await _supabase.auth.getSession();
  return data?.session?.access_token || null;
}
```

Écouter les changements d'état auth :
```javascript
_supabase.auth.onAuthStateChange(async (event, session) => {
  _authUser = session?.user || null;
  if (_authUser) {
    await checkPremiumStatus(_authUser.email);
    // Si window._pendingSubscribe était true (venu de la landing page) :
    if (window._pendingSubscribe) {
      window._pendingSubscribe = false;
      setTimeout(() => showPremiumModal(), 300);
    }
  }
  updateAuthUI();
});
```

**Détection email déjà utilisé à l'inscription** (Supabase masque l'erreur pour éviter l'énumération) :
```javascript
const { data: { user } } = await _supabase.auth.signUp({ email, password, options: { data: { username } } });
// Si l'email existe déjà, Supabase retourne un user avec identities: []
if (user && user.identities?.length === 0) {
  // Afficher "Cet email est déjà utilisé"
}
```

---

### Phase 9 — Abonnement Stripe + API Backend

**Objectif** : paiement fonctionnel, vérification premium côté serveur.

**9.1 — Créer le produit Stripe**
1. Compte Stripe → Produits → Créer : "CarGo Standard", 12,99€/mois récurrent
2. Récupérer `STRIPE_PRICE_ID` (commence par `price_`)
3. Récupérer `STRIPE_SECRET_KEY` (`sk_live_...` ou `sk_test_...` pour les tests)

**9.2 — Ajouter le dossier `api/` dans le projet**

Tout est dans le même repo. Il suffit de créer le sous-dossier `api/` :

```
CarGo/
├── ... (frontend existant)
├── package.json
├── vercel.json
└── api/
    ├── check-subscription.js
    ├── create-checkout.js
    ├── customer-portal.js
    └── cancel-subscription.js
```

`package.json` (à la racine du projet) :
```json
{
  "name": "cargo",
  "version": "1.0.0",
  "private": true,
  "engines": { "node": "20.x" },
  "dependencies": { "stripe": "14.25.0" }
}
```

`vercel.json` (à la racine du projet) :
```json
{
  "headers": [{
    "source": "/api/(.*)",
    "headers": [
      { "key": "Access-Control-Allow-Origin", "value": "*" },
      { "key": "Access-Control-Allow-Methods", "value": "GET,POST,OPTIONS" },
      { "key": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization" }
    ]
  }]
}
```

**Note sur le CORS** : pendant le développement avec Live Server (`http://127.0.0.1:5500`), les appels à l'API Vercel déployée fonctionnent car `"*"` autorise toutes les origines. En production (app Capacitor), remplacer `"*"` par l'origine exacte de l'app native (`capacitor://localhost`) pour restreindre l'accès.

**Variables d'environnement à définir dans le dashboard Vercel** :
- `STRIPE_SECRET_KEY` — clé secrète Stripe
- `STRIPE_PRICE_ID` — ID du prix Stripe
- `SUPABASE_JWT_SECRET` — clé JWT Supabase **Legacy HS256** (Settings → API → JWT Settings → Legacy HS256 Secret)
- `OWNER_EMAIL` — ton email personnel (accès premium gratuit)

**Vérification JWT Supabase** — à copier dans chaque endpoint sécurisé :
```javascript
const crypto = require('crypto');

function verifyJWT(authHeader) {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret || !authHeader?.startsWith('Bearer ')) return null;
  try {
    const [header, payload, sig] = authHeader.slice(7).split('.');
    if (!header || !payload || !sig) return null;
    const expected = crypto.createHmac('sha256', secret)
      .update(`${header}.${payload}`).digest('base64url');
    if (expected.length !== sig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch { return null; }
}
```

**`GET /api/check-subscription`** — vérifie si l'utilisateur a un abonnement actif
- Auth JWT obligatoire → email pris depuis le token (jamais depuis le query param)
- Vérifie d'abord si email === `OWNER_EMAIL` → `{ premium: true, isOwner: true }`
- Sinon interroge Stripe : `stripe.customers.list({ email })` puis `stripe.subscriptions.list({ customer, status: 'active' })`

**`GET /api/create-checkout`** — crée une session Stripe Checkout
- Auth JWT obligatoire
- Retourne `{ url }` vers le formulaire de paiement Stripe, ou `{ owner: true }` si owner
- `success_url` : `https://<ton-projet>.vercel.app/?premium=success` (ou ton domaine custom)

**`GET /api/customer-portal`** — portail Stripe pour gérer son abonnement
- Auth JWT obligatoire
- Retourne `{ url }` vers le portail Stripe

**`GET /api/cancel-subscription`** — annule l'abonnement
- Auth JWT obligatoire
- Appelle `stripe.subscriptions.update(id, { cancel_at_period_end: true })`

**9.3 — `js/premium.js`** — côté frontend

**URL de l'API** : puisque frontend et API sont sur le même domaine Vercel, utiliser des chemins relatifs :
```javascript
const CARGO_API = ''; // vide = même domaine
// Appel : fetch(`${CARGO_API}/api/check-subscription`, ...)
// → devient : fetch('/api/check-subscription', ...)
```
Pendant le dev avec Live Server, `CARGO_API` pointe vers l'URL Vercel déployée :
```javascript
const CARGO_API = window.location.hostname === '127.0.0.1'
  ? 'https://<ton-projet>.vercel.app'
  : '';
```

État premium protégé en closure (inaccessible depuis la console) :
```javascript
const _premiumState = (() => {
  let _v = false;
  return { get: () => _v, set: (v) => { _v = (v === true); } };
})();

function isPremium() { return _premiumState.get(); }
```

`checkPremiumStatus(email)` — appelée depuis `onAuthStateChange` :
```javascript
async function checkPremiumStatus(email) {
  // Sécurité : vérifier que l'email correspond à l'utilisateur connecté
  const authUser = getAuthUser();
  if (!authUser || authUser.email !== email) return;
  const token = await getAuthToken();
  if (!token) { applyPremium(false); return; }
  const res = await fetch(`${CARGO_API}/api/check-subscription`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) { applyPremium(false); return; }
  const data = await res.json();
  _premiumState.set(!!data.premium);
  applyPremium(_premiumState.get());
}
```

**Limites freemium** :
| Feature | Gratuit | Premium |
|---|---|---|
| Adresses max | 10 | Illimité |
| Secteurs utilisables | 0, 1, 2 | 0 à 5 |
| Verrouillages | 1 max | Illimité |
| Alertes de proximité | ✗ | ✓ |
| Publicités | ✓ | ✗ |

**9.4 — Déployer le projet sur Vercel**
1. Push le repo sur GitHub
2. Vercel dashboard → Import project → choisir le repo
3. Ajouter les 4 variables d'environnement
4. Deploy — Vercel sert à la fois le frontend (`index.html`) et les fonctions `api/`

**IMPORTANT — Vercel Hobby** : les déploiements sont déclenchés depuis le dashboard Vercel ou via un Deploy Hook URL. Ne jamais utiliser la CLI Vercel (risque de corruption des projets). Si le déploiement GitHub est bloqué (erreur "committer not associated"), utiliser le Deploy Hook : Vercel → Settings → Git → Deploy Hooks.

---

### Phase 10 — PWA (Service Worker)

**Objectif** : l'app s'installe sur mobile comme une vraie app.

**`manifest.json`** :
```json
{
  "name": "CarGo",
  "short_name": "CarGo",
  "description": "Optimisez vos tournées de livraison",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#141a24",
  "theme_color": "#141a24",
  "lang": "fr",
  "icons": [
    { "src": "./icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable" }
  ]
}
```

**`sw.js`** — cache-first avec stale-while-revalidate :
```javascript
const CACHE = 'cargo-v1'; // bumper ce numéro à chaque déploiement important

const ASSETS = [
  './index.html', './manifest.json',
  './css/variables.css', './css/layout.css', /* ... tous les fichiers CSS et JS */
];

const BYPASS = ['googleapis.com', 'gstatic.com', 'supabase.co', 'vercel.app', 'doubleclick.net', 'jsdelivr.net'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (BYPASS.some(d => e.request.url.includes(d))) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(r => {
        if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        return r;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
```

**Enregistrement du SW** dans `index.html` ou `app.js` :
```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
```

**Mise à jour** : bumper le numéro de version dans `CACHE` (ex: `cargo-v2`) **à chaque déploiement** pour invalider l'ancien cache. L'afficher aussi dans l'UI (ex: `<span>v1</span>` dans le header).

> **Checkpoint Phase 10** : sur mobile Chrome Android, une bannière "Ajouter à l'écran d'accueil" doit apparaître.

---

### Phase 11 — Distribution sur les stores (dernière phase)

**Objectif** : packager l'app web en application native Android et iOS, et la soumettre sur Google Play et l'App Store.

**Cette phase se fait en tout dernier**, une fois que l'app est complète, testée et stable.

#### Technologie : Capacitor

**Capacitor** (par l'équipe Ionic) est l'outil qui encapsule le code web (HTML/CSS/JS) dans une coque native Android/iOS. Il n'impose aucun framework — il fonctionne parfaitement avec du Vanilla JS.

Il ne remplace pas le code existant, il l'enveloppe dans une WebView native.

#### Prérequis

- **Android** : Android Studio installé + SDK Android
- **iOS** : Mac + Xcode installé (obligatoire pour build iOS)
- **Node.js** installé (pour Capacitor CLI)

#### Installation de Capacitor dans le projet

```bash
npm init -y
npm install @capacitor/core @capacitor/cli
npx cap init CarGo com.cargo.app --web-dir .
npm install @capacitor/android @capacitor/ios
```

Cela crée un `capacitor.config.json` :
```json
{
  "appId": "com.cargo.app",
  "appName": "CarGo",
  "webDir": ".",
  "server": { "androidScheme": "https" }
}
```

#### Build Android

```bash
npx cap add android
npx cap sync android
npx cap open android   ← ouvre Android Studio
```

Dans Android Studio : **Build → Generate Signed Bundle/APK** pour créer le fichier `.aab` à soumettre sur Google Play.

#### Build iOS

```bash
npx cap add ios
npx cap sync ios
npx cap open ios   ← ouvre Xcode
```

Dans Xcode : sélectionner le bon certificat de distribution, **Product → Archive**, soumettre via Transporter.

#### Adaptations nécessaires pour Capacitor

Quelques points à ajuster quand on passe en mode natif :

1. **Google Maps** : ajouter `com.cargo.app` aux restrictions de la clé Maps (en plus du referrer web)
2. **CORS de l'API** : l'app native envoie des requêtes depuis `capacitor://localhost` — remplacer `"*"` par `"capacitor://localhost"` dans `vercel.json`
3. **Service Worker** : Capacitor gère son propre cache, le SW est moins utile en mode natif (peut être désactivé)
4. **Icônes et splash screen** : générer des icônes PNG en toutes tailles avec `@capacitor/assets`
5. **Permissions** : déclarer la géolocalisation dans `AndroidManifest.xml` et `Info.plist`

#### Soumission sur les stores

- **Google Play** : créer un compte développeur (25$ une seule fois), soumettre le `.aab`
- **App Store** : créer un compte Apple Developer (99$/an), soumettre via Xcode + Transporter

> **Checkpoint Phase 11** : l'app se lance sur un téléphone Android réel depuis Android Studio. La navigation GPS fonctionne.

---

## Mode simulation (`js/simulation.js`)

Utile pour tester la navigation sans se déplacer physiquement.
Activé en cliquant sur le numéro de version dans le header (easter egg discret).

```javascript
let _simMode = false;

function toggleSimMode() {
  _simMode = !_simMode;
  // Afficher "[SIM]" en rouge dans le header
}

function tickSimulation() {
  // Extraire tous les step.path de state.navLegs
  // Avancer de 12 points toutes les 200ms sur la polyline
  // Appeler updateGPS(lat, lng) avec les coordonnées simulées
}
```

---

## APIs Google Maps à utiliser dans le nouveau projet

Le projet actuel (`livreurGPS`) utilise des APIs Google Maps dépréciées. **Dans le nouveau projet, utiliser directement les nouvelles APIs** pour ne pas accumuler de dette technique.

| Ancienne API (à ne pas utiliser) | Nouvelle API à utiliser |
|---|---|
| `google.maps.Marker` | `google.maps.marker.AdvancedMarkerElement` |
| `google.maps.places.Autocomplete` | `google.maps.places.PlaceAutocompleteElement` |
| `google.maps.DirectionsService` | `google.maps.routes.RoutesService` |
| `google.maps.DirectionsRenderer` | Rendu manuel de la polyline avec `google.maps.Polyline` |

**Note importante sur le chargement Maps** : utiliser le chargement async recommandé par Google :
```html
<!-- À la place du script src classique : -->
<script>
  (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("key",g.key??"");e.set("callback",c+".maps."+q);a.src=`https://maps.${c}apis.com/maps/api/js?`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})
  ({key: "VOTRE_CLE", v: "weekly"});
</script>
```

Puis charger les bibliothèques à la demande :
```javascript
async function initApp() {
  const { Map } = await google.maps.importLibrary('maps');
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
  const { PlaceAutocompleteElement } = await google.maps.importLibrary('places');
  // ...
}
```

**JWT Supabase** : Supabase émet désormais des tokens **ES256** (ECDSA, asymétrique) et non plus HS256. La vérification côté API doit récupérer la clé publique depuis le endpoint JWKS de Supabase (`/auth/v1/.well-known/jwks.json`). Voir la fonction `verifyJWT` complète dans le projet de référence `cargo-api`.

---

## Règles de sécurité importantes

| Point | Règle |
|---|---|
| Clé Google Maps | Restreindre aux referrers GitHub Pages + `com.cargo.app` pour Capacitor |
| JWT Supabase | Supabase émet des tokens **ES256** — vérifier via JWKS, pas HMAC |
| Email owner | Uniquement en variable d'env Vercel, jamais dans le code frontend |
| `_premiumState` | Toujours en closure, jamais `window.premiumState` |
| `escHtml()` | Utiliser sur tout contenu utilisateur injecté dans le DOM |
| CORS | `Authorization` doit être dans `Access-Control-Allow-Headers` |
| Stripe test vs live | `sk_test_` et `price_test_` ensemble, `sk_live_` et `price_live_` ensemble |

---

## Pièges connus à éviter absolument

1. **`class X extends google.maps.OverlayView` au niveau global** → crash immédiat. Toujours utiliser une factory function.
2. **Bumper `CACHE` dans `sw.js`** à chaque déploiement sinon le Service Worker sert l'ancienne version.
3. **Ne jamais déployer sur Vercel via CLI** → utilise le dashboard Vercel ou un Deploy Hook.
4. **`SUPABASE_JWT_SECRET`** : prendre la clé "Legacy HS256" dans Supabase Settings → API → JWT Settings. Pas la clé ECC.
5. **Google Directions** : max 23 waypoints par requête. Au-delà, faire du batching.
6. **`state.navLegs`** : ne pas accéder avant que l'optimisation soit terminée.

---

## Checklist de départ (avant de coder)

**Claude doit guider la réalisation de cette checklist avant de commencer à coder.**

### Immédiat (Phase 0)
- [ ] VS Code installé avec l'extension **Live Server** (Ritwick Dey)
- [ ] Dossier projet créé, ouvert dans VS Code
- [ ] `index.html` minimal créé, Live Server fonctionnel sur `http://127.0.0.1:5500/`
- [ ] Git initialisé, repo GitHub créé, premier push fait

### Avant Phase 2 (Google Maps)
- [ ] Clé Google Maps créée, APIs activées, referrer restreint

### Avant Phase 8 (Auth)
- [ ] Projet Supabase créé, table `profiles` + trigger créés

### Avant Phase 9 (Stripe)
- [ ] Compte Stripe créé, produit 12,99€/mois créé
- [ ] Dossier `api/` créé dans le projet, repo déployé sur Vercel avec les 4 variables d'environnement

### Avant Phase 11 (Stores — en tout dernier)
- [ ] GitHub Pages activé, app testée sur mobile via l'URL publique
- [ ] Android Studio installé (pour Android)
- [ ] Compte Google Play Developer créé (25$ une fois)
- [ ] Compte Apple Developer créé si iOS souhaité (99$/an, nécessite un Mac + Xcode)
