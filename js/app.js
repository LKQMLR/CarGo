/* ══════════════════════════════════════════
   CarGo — Point d'entrée
   State global, init, session, UI helpers
   ══════════════════════════════════════════ */

// ── STATE GLOBAL ──
const state = {
  map: null, geocoder: null, directionsService: null, directionsRenderer: null,
  startPoint: null, deliveries: [], markers: [],
  navStops: null, navLegs: null, navIndex: 0,
  watchId: null, posMarker: null, posCircle: null, followMode: true, wakeLock: null,
  previewMap: null, previewRenderer: null, previewMarkers: [],
};
let idCounter = 0;

// ── CLÉ API (protégée par restriction HTTP referrer) ──
const API_KEY = 'AIzaSyAMvy_xjhvYS51Yyy6bNMgJrMRLpvVd8Go';

// ── CHARGEMENT GOOGLE MAPS ──
function loadGoogleMaps(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) { resolve(); return; }
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=fr&region=FR`;
    s.async = true; s.defer = true; s.onload = resolve;
    s.onerror = () => reject(new Error('Impossible de charger Google Maps.'));
    document.head.appendChild(s);
  });
}

// ── DÉMARRAGE ──
window.addEventListener('DOMContentLoaded', async () => {
  const dot = document.getElementById('api-dot');
  try { await loadGoogleMaps(API_KEY); initApp(); } catch {
    dot.classList.add('off');
  }
});

function initApp() {
  const dot = document.getElementById('api-dot');
  dot.classList.remove('off'); dot.classList.add('on');
  document.getElementById('app-sections').classList.add('visible');

  // Carte principale
  state.map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 46.603354, lng: 1.888334 }, zoom: 6,
    mapTypeControl: true,
    mapTypeControlOptions: { style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR, position: google.maps.ControlPosition.TOP_LEFT },
    streetViewControl: true, fullscreenControl: false, zoomControl: true,
  });
  state.geocoder = new google.maps.Geocoder();
  state.directionsService = new google.maps.DirectionsService();

  const arrowSymbol = {
    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
    scale: 2.5, strokeColor: '#fff', strokeWeight: 1, fillColor: '#fff', fillOpacity: 0.9
  };
  state.directionsRenderer = new google.maps.DirectionsRenderer({
    map: state.map, suppressMarkers: true,
    polylineOptions: { strokeColor: '#4f8cff', strokeWeight: 5, strokeOpacity: 0.9, icons: [{ icon: arrowSymbol, offset: '0', repeat: '80px' }] },
  });

  // Mini carte mobile
  if (window.innerWidth <= 768) {
    state.previewMap = new google.maps.Map(document.getElementById('map-preview'), {
      center: state.map.getCenter(), zoom: state.map.getZoom(),
      disableDefaultUI: true, gestureHandling: 'none', clickableIcons: false,
    });
    state.previewRenderer = new google.maps.DirectionsRenderer({
      map: state.previewMap, suppressMarkers: true,
      polylineOptions: { strokeColor: '#4f8cff', strokeWeight: 3, strokeOpacity: 0.9 },
    });
    state.map.addListener('bounds_changed', () => {
      state.previewMap.setCenter(state.map.getCenter());
      state.previewMap.setZoom(state.map.getZoom());
    });
  }

  // Autocomplete & adresses fréquentes
  setupAutocomplete('start-input');
  setupAutocomplete('delivery-input');
  setupFreqDropdown('start-input', 'freq-start');
  setupFreqDropdown('delivery-input', 'freq-delivery');

  // Raccourcis clavier
  document.getElementById('start-input').addEventListener('keydown', e => { if (e.key === 'Enter') handleSetStart(); });
  document.getElementById('delivery-input').addEventListener('keydown', e => { if (e.key === 'Enter') handleAddDelivery(); });

  // Préférences carte
  restoreMapPrefs();
  state.map.addListener('dragstart', () => {
    if (state.watchId !== null) {
      state.followMode = false;
      clearTimeout(state._recenterTimer);
      state._recenterTimer = setTimeout(() => { if (state.watchId !== null) centerOnMe(); }, 5000);
    }
  });
  state.map.addListener('maptypeid_changed', saveMapPrefs);
  state.map.addListener('idle', saveMapPrefs);
  state.map.addListener('tilt_changed', saveMapPrefs);
  state.map.addListener('heading_changed', saveMapPrefs);

  restoreSession();

  // Initialiser le système premium
  if (typeof initPremium === 'function') initPremium();
}

// ── SESSION PERSISTENCE ──
function saveSession() {
  const data = {
    startPoint: state.startPoint ? { address: state.startPoint.address, lat: state.startPoint.lat, lng: state.startPoint.lng, formatted: state.startPoint.formatted } : null,
    deliveries: state.deliveries.map(d => ({
      id: d.id, address: d.address, lat: d.lat, lng: d.lng, formatted: d.formatted,
      placeName: d.placeName || '', note: d.note || '',
      legDist: d.legDist || '', legDur: d.legDur || '',
      locked: d.locked || false, customOrder: d.customOrder || false, sector: d.sector || 0
    })),
    routeOptimized: !!state.navStops,
    navActive: !!document.getElementById('nav-panel').classList.contains('visible'),
    navIndex: state.navIndex,
    idCounter: idCounter,
  };
  localStorage.setItem('nexum_session', JSON.stringify(data));
}

function restoreSession() {
  try {
    const data = JSON.parse(localStorage.getItem('nexum_session'));
    if (!data || (!data.startPoint && !data.deliveries.length)) {
      // Pas de session mais peut-être un point de départ sauvegardé
      const sp = localStorage.getItem('cargo_startPoint');
      if (sp) {
        const s = JSON.parse(sp);
        const marker = createClassicMarker({ lat: s.lat, lng: s.lng }, 'D', '#22c55e', 'Départ');
        state.startPoint = { ...s, marker };
        const d = document.getElementById('start-display'); d.textContent = s.formatted; d.classList.add('visible');
        document.getElementById('start-input').value = s.address;
        updateAutocompleteBias();
      }
      return;
    }
    idCounter = data.idCounter || 0;

    // Restaurer le point de départ
    if (data.startPoint) {
      const s = data.startPoint;
      const marker = createClassicMarker({ lat: s.lat, lng: s.lng }, 'D', '#22c55e', 'Départ');
      state.startPoint = { ...s, marker };
      const d = document.getElementById('start-display'); d.textContent = s.formatted; d.classList.add('visible');
      document.getElementById('start-input').value = s.address;
    }

    // Restaurer les livraisons
    if (data.deliveries.length) {
      data.deliveries.forEach(d => {
        const marker = createClassicMarker({ lat: d.lat, lng: d.lng }, String(state.deliveries.length + 1), '#ef4444', d.formatted);
        state.deliveries.push({ ...d, marker });
      });
      renderDeliveryList();
    }

    // Restaurer l'itinéraire
    if (data.routeOptimized && state.startPoint && state.deliveries.length) {
      displayRoute([state.startPoint, ...state.deliveries]);
      if (data.navActive && data.navIndex >= 0) {
        setTimeout(() => {
          state.navIndex = data.navIndex;
          document.getElementById('btn-nav-start').classList.remove('visible');
          document.getElementById('nav-panel').classList.add('visible');
          updateNavPanel(); renderRouteSteps();
        }, 1000);
      }
    }
  } catch {}
}

// ── MAP PREFERENCES ──
function saveMapPrefs() {
  localStorage.setItem('nexum_mapPrefs', JSON.stringify({
    mapTypeId: state.map.getMapTypeId(), zoom: state.map.getZoom(),
    center: { lat: state.map.getCenter().lat(), lng: state.map.getCenter().lng() },
    tilt: state.map.getTilt(), heading: state.map.getHeading(),
  }));
}

function restoreMapPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem('nexum_mapPrefs'));
    if (p && p.center) {
      if (p.mapTypeId) state.map.setMapTypeId(p.mapTypeId);
      if (p.zoom) state.map.setZoom(p.zoom);
      state.map.setCenter(p.center);
      if (p.tilt != null) state.map.setTilt(p.tilt);
      if (p.heading != null) state.map.setHeading(p.heading);
      return;
    }
  } catch {}
  // Pas de préférences → centrer sur la position de l'utilisateur
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      state.map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      state.map.setZoom(13);
    }, () => {}, { enableHighAccuracy: false, timeout: 5000 });
  }
}

// ── UI HELPERS ──
function showStatus(type, msg) {
  const b = document.getElementById('status-bar');
  b.className = `visible ${type}`;
  b.innerHTML = `${type === 'loading' ? '<div class="spinner"></div>' : type === 'success' ? '&#10003;' : '!'} ${msg}`;
}

function setUIBusy(b) {
  ['btn-set-start', 'btn-add', 'btn-optimize', 'btn-reset', 'btn-nav-start'].forEach(id => {
    const e = document.getElementById(id); if (e) e.disabled = b;
  });
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const btn = document.getElementById('mobile-toggle');
  sb.classList.toggle('hidden');
  btn.innerHTML = sb.classList.contains('hidden')
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></svg>';
}

function resetAll() {
  if (!confirm('Réinitialiser la tournée ? Toutes les adresses et le tracé seront effacés.')) return;
  state._tourComplete = false;
  clearMarkers(); state.directionsRenderer.setDirections({ routes: [] });
  if (state.previewRenderer) state.previewRenderer.setDirections({ routes: [] });
  if (state.startPoint?.marker) { state.startPoint.marker.setMap(null); }
  if (state._routePoly) { state._routePoly.setMap(null); state._routePoly = null; }
  if (state._routePolyPreview) { state._routePolyPreview.setMap(null); state._routePolyPreview = null; }
  if (state._completedPoly) { state._completedPoly.setMap(null); state._completedPoly = null; }
  state.startPoint = null;
  state.deliveries.forEach(d => { if (d.marker) d.marker.setMap(null); });
  state.deliveries = [];
  if (state.watchId !== null) { navigator.geolocation.clearWatch(state.watchId); state.watchId = null; }
  if (state.posMarker) { state.posMarker.setMap(null); state.posMarker = null; }
  if (state.posCircle) { state.posCircle.setMap(null); state.posCircle = null; }
  state.navStops = null; state.navLegs = null; state.navIndex = 0;
  document.getElementById('delivery-list').innerHTML = '';
  document.getElementById('delivery-count').textContent = '';
  const sd = document.getElementById('start-display'); if (sd) { sd.textContent = ''; sd.classList.remove('visible'); }
  document.getElementById('results-panel').classList.remove('visible');
  document.getElementById('nav-panel').classList.remove('visible');
  document.getElementById('btn-nav-start').classList.remove('visible');
  document.getElementById('status-bar').className = '';
  localStorage.removeItem('nexum_session');
}

// Service Worker
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
