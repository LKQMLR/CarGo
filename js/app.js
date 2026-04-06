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

// ── MIGRATION localStorage nexum_ → cargo_ (anciennes clés uniquement) ──
['nexum_session', 'nexum_freqAddr', 'nexum_mapPrefs'].forEach(oldKey => {
  const val = localStorage.getItem(oldKey);
  if (val !== null) {
    localStorage.setItem(oldKey.replace('nexum_', 'cargo_'), val);
    localStorage.removeItem(oldKey);
  }
});
// Supprimer l'ancien cargo_premium_status (la vérification est désormais serveur uniquement)
localStorage.removeItem('cargo_premium_status');

// ── DÉMARRAGE ──
window.addEventListener('DOMContentLoaded', async () => {
  const dot = document.getElementById('api-dot');
  try { await loadGoogleMaps(API_KEY); initApp(); } catch {
    dot.classList.add('off');
  }
});

window.addEventListener('load', () => {
  if (window.location.hash === '#subscribe') {
    history.replaceState(null, '', window.location.pathname);
    // Attendre que l'auth soit prête avant d'ouvrir la modale
    setTimeout(() => {
      if (typeof showPremiumModal === 'function') showPremiumModal();
    }, 800);
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
      tilt: 0,
      styles: [
        { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        { featureType: 'road.local',           stylers:                        [{ visibility: 'off' }] },
        { featureType: 'road.arterial',       stylers:                        [{ visibility: 'off' }] },
        { featureType: 'road.highway',        elementType: 'geometry.fill',   stylers: [{ color: '#e2e2e2' }] },
        { featureType: 'road.highway',        elementType: 'geometry.stroke', stylers: [{ color: '#ececec' }] },
        { featureType: 'road',                elementType: 'labels',          stylers: [{ visibility: 'off' }] },
        { featureType: 'administrative',      elementType: 'labels',          stylers: [{ visibility: 'off' }] },
        { featureType: 'poi',                 stylers:                        [{ visibility: 'off' }] },
        { featureType: 'transit',             stylers:                        [{ visibility: 'off' }] },
        { featureType: 'landscape',           elementType: 'geometry',        stylers: [{ color: '#f2f2f2' }] },
        { featureType: 'water',               elementType: 'geometry',        stylers: [{ color: '#d4eaf5' }] },
      ],
    });
    state.previewRenderer = new google.maps.DirectionsRenderer({
      map: state.previewMap, suppressMarkers: true,
      polylineOptions: { strokeColor: '#4f8cff', strokeWeight: 4, strokeOpacity: 1 },
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
  document.getElementById('save-history-name').addEventListener('keydown', e => { if (e.key === 'Enter') saveToHistory(); if (e.key === 'Escape') closeSaveHistoryModal(); });

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
  if (typeof checkSharedRoute === 'function') checkSharedRoute();

  // Initialiser l'authentification puis le système premium
  if (typeof initAuth === 'function') initAuth();
  if (typeof initPremium === 'function') initPremium();
}

// ── SESSION PERSISTENCE ──
function saveSession() {
  try {
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
    localStorage.setItem('cargo_session', JSON.stringify(data));
  } catch (e) {
    console.error('[CarGo] Erreur sauvegarde session:', e);
  }
}

function restoreSession() {
  try {
    const raw = localStorage.getItem('cargo_session');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || (!data.startPoint && !data.deliveries.length)) {
      // Pas de session mais peut-être un point de départ sauvegardé
      const sp = localStorage.getItem('cargo_startPoint');
      if (sp) {
        const s = JSON.parse(sp);
        const marker = createClassicMarker({ lat: s.lat, lng: s.lng }, 'D', '#22c55e', 'Départ');
        state.startPoint = { ...s, marker };
        const d = document.getElementById('start-display'); d.textContent = s.formatted; d.classList.add('visible');
        const si2 = document.getElementById('start-input'); si2.value = s.address;
        si2.dataset.formatted = s.formatted; si2.dataset.lat = s.lat; si2.dataset.lng = s.lng;
        updateAutocompleteBias(); updateFavStar();
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
      const si = document.getElementById('start-input'); si.value = s.address;
      si.dataset.formatted = s.formatted; si.dataset.lat = s.lat; si.dataset.lng = s.lng;
    }
    updateFavStar();

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
  } catch (e) {
    console.error('[CarGo] ERREUR restauration session:', e);
    // Tenter de restaurer au moins le point de départ
    try {
      const sp = localStorage.getItem('cargo_startPoint');
      if (sp) {
        const s = JSON.parse(sp);
        const marker = createClassicMarker({ lat: s.lat, lng: s.lng }, 'D', '#22c55e', 'Départ');
        state.startPoint = { ...s, marker };
        document.getElementById('start-display').textContent = s.formatted;
        document.getElementById('start-display').classList.add('visible');
        document.getElementById('start-input').value = s.address;
      }
    } catch {}
  }
}

// ── MAP PREFERENCES ──
function saveMapPrefs() {
  localStorage.setItem('cargo_mapPrefs', JSON.stringify({
    mapTypeId: state.map.getMapTypeId(), zoom: state.map.getZoom(),
    center: { lat: state.map.getCenter().lat(), lng: state.map.getCenter().lng() },
    tilt: state.map.getTilt(), heading: state.map.getHeading(),
  }));
}

function restoreMapPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem('cargo_mapPrefs'));
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

// ── TOOLTIP PANEL (position:fixed, hors contexte de clipping) ──
function showPanelTip(el, text) {
  const tip = document.getElementById('panel-tooltip');
  tip.innerHTML = text;
  tip.style.display = 'block';
  const r = el.getBoundingClientRect();
  let left = r.right - 220;
  if (left < 8) left = 8;
  tip.style.left = left + 'px';
  tip.style.top = (r.bottom + 8) + 'px';
}
function hidePanelTip() {
  document.getElementById('panel-tooltip').style.display = 'none';
}
const _PANEL_TIPS = {
  start: 'Entrepôt, dépôt ou domicile. CarGo calcule l\'itinéraire optimal depuis ce point.',
  deliveries: '↕ Glisser-déposer pour réordonner · Double-tap pour changer de secteur · <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Cadenas pour figer une position dans l\'itinéraire',
};
// Délégation : aucune init requise, fonctionne dès le chargement du DOM
document.addEventListener('mousedown', e => {
  const btn = e.target.closest('.help-btn[data-tip-key]');
  if (btn) showPanelTip(btn, _PANEL_TIPS[btn.dataset.tipKey] || '');
});
document.addEventListener('mouseup', hidePanelTip);
document.addEventListener('touchstart', e => {
  const btn = e.target.closest('.help-btn[data-tip-key]');
  if (btn) showPanelTip(btn, _PANEL_TIPS[btn.dataset.tipKey] || '');
}, { passive: true });
document.addEventListener('touchend', hidePanelTip, { passive: true });
document.addEventListener('touchcancel', hidePanelTip, { passive: true });

// ── CONFIRM CUSTOM (remplace window.confirm) ──
function showConfirm(msg) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-msg').innerHTML = msg;
    modal.classList.add('visible');
    const input = document.activeElement;
    if (input && input.blur) input.blur(); // ferme le clavier
    const ok = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');
    function close(result) {
      modal.classList.remove('visible');
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      resolve(result);
    }
    function onOk() { close(true); }
    function onCancel() { close(false); }
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
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
  localStorage.removeItem('cargo_session');
}

// ── VIDER LE CACHE (sans race condition) ──
async function clearCacheAndData() {
  if (!confirm('Effacer toutes les données (cache, session, préférences) et recharger ?')) return;
  const sp = localStorage.getItem('cargo_startPoint');
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    localStorage.clear();
    if (sp) localStorage.setItem('cargo_startPoint', sp);
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
  } catch (e) { console.error('Erreur nettoyage:', e); }
  location.reload(true);
}

// ── SAUVEGARDE À LA FERMETURE ──
// Sauvegarde quand l'app perd le focus, est mise en arrière-plan ou fermée
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && state.deliveries.length) saveSession();
});
window.addEventListener('pagehide', () => {
  if (state.deliveries.length) saveSession();
});
window.addEventListener('beforeunload', () => {
  if (state.deliveries.length) saveSession();
});

// Service Worker
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');

// ── PULL-TO-REFRESH ──
(function () {
  const THRESHOLD = 72;
  let startY = 0, active = false;
  const indicator = document.getElementById('ptr-indicator');
  const sb = document.getElementById('sidebar');
  if (!indicator || !sb) return;

  sb.addEventListener('touchstart', e => {
    if (sb.scrollTop === 0) { startY = e.touches[0].clientY; active = true; }
  }, { passive: true });

  sb.addEventListener('touchmove', e => {
    if (!active) return;
    const delta = e.touches[0].clientY - startY;
    if (delta <= 0) { active = false; return; }
    e.preventDefault(); // bloque le rubber-band iOS
    const h = Math.min(delta * 0.45, THRESHOLD);
    indicator.style.height = h + 'px';
    indicator.classList.toggle('pulling', h > 4);
    indicator.classList.toggle('ready', delta > THRESHOLD);
  }, { passive: false });

  sb.addEventListener('touchend', () => {
    if (!active) return;
    active = false;
    const triggered = indicator.classList.contains('ready');
    indicator.style.height = '0';
    indicator.classList.remove('pulling', 'ready');
    if (triggered) location.reload();
  }, { passive: true });
})();
