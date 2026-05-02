/* ══════════════════════════════════════════
   CarGo — Navigation GPS
   Suivi temps réel, alertes de proximité,
   wake lock, détection retour auto
   ══════════════════════════════════════════ */

// ── DÉMARRER LA TOURNÉE ──
function startNavigation() {
  if (!state.navStops || !state.navLegs) return;
  if (!navigator.geolocation) { showStatus('error', 'Géolocalisation non disponible sur ce navigateur.'); return; }
  state.navIndex = 0; state.followMode = true;
  _proximityAlertShown = {}; _proximityAlertOpen = false;
  document.getElementById('btn-nav-start').classList.remove('visible');
  document.getElementById('nav-panel').classList.add('visible');
  updateNavPanel(); renderDeliveryList(); renderRouteSteps(); updateRouteProgress(); saveSession();

  if (_simMode) {
    state.watchId = 1; // ID fictif pour la simulation
    startSim();
  } else {
    openInGoogleMaps();
    requestWakeLock();
    state.watchId = navigator.geolocation.watchPosition(
      pos => updateGPSPosition(pos.coords),
      err => {
        const msgs = { 1: 'Géolocalisation refusée.', 2: 'Position indisponible.', 3: 'Délai dépassé.' };
        showStatus('error', msgs[err.code] || 'Erreur GPS.');
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  }
}

// ── MISE À JOUR POSITION GPS ──
function updateGPSPosition(coords) {
  const pos = { lat: coords.latitude, lng: coords.longitude };
  const dotSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="13" fill="rgba(66,133,244,.15)"/>
    <circle cx="14" cy="14" r="7" fill="#4285F4" stroke="#fff" stroke-width="2.5"/></svg>`;

  if (!state.posMarker) {
    state.posMarker = new google.maps.Marker({
      position: pos, map: state.map, zIndex: 2000,
      icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(dotSvg),
        scaledSize: new google.maps.Size(28, 28), anchor: new google.maps.Point(14, 14) }
    });
    state.posCircle = new google.maps.Circle({
      map: state.map, center: pos,
      radius: Math.min(coords.accuracy || 50, 500),
      fillColor: '#4285F4', fillOpacity: 0.08, strokeColor: '#4285F4', strokeOpacity: 0.25, strokeWeight: 1, clickable: false
    });
  } else {
    state.posMarker.setPosition(pos);
    state.posCircle.setCenter(pos);
    state.posCircle.setRadius(Math.min(coords.accuracy || 50, 500));
  }

  if (state.followMode) { state.map.panTo(pos); state.map.setZoom(Math.max(state.map.getZoom(), 16)); }

  // Distance par rapport à la destination en cours
  if (state.navStops && state.navIndex < state.deliveries.length) {
    const dest = state.navStops[state.navIndex + 1];
    const dist = haversine(pos, dest);
    const meta = document.getElementById('nav-meta');
    if (dist < 80) {
      meta.textContent = 'Vous êtes arrivé !';
      meta.classList.add('nav-arrived');
      const statusEl = document.getElementById('nav-status');
      statusEl.textContent = 'Trajet terminé';
      statusEl.classList.add('arrived');
      if (_simMode && !state._simAutoAdvancing) {
        state._simAutoAdvancing = true;
        setTimeout(() => { state._simAutoAdvancing = false; nextNavStop(); }, 1500);
      }
    } else {
      meta.textContent = dist < 1000 ? Math.round(dist) + ' m restant' : (dist / 1000).toFixed(1) + ' km restant';
      meta.classList.remove('nav-arrived');
    }
    checkProximityAlert(pos);
  }
}

// ── ALERTES DE PROXIMITÉ ──
let _proximityAlertShown = {};
let _proximityAlertOpen = false;

function checkProximityAlert(pos) {
  if (!canUseProximityAlerts()) return;
  const cb = document.getElementById('prox-check');
  if (!cb || !cb.checked) return;
  if (_proximityAlertOpen) return;
  const RADIUS = 150; // mètres
  for (let i = state.navIndex + 3; i < state.deliveries.length; i++) {
    const d = state.deliveries[i];
    const dist = haversine(pos, d);
    if (dist < RADIUS && !_proximityAlertShown[d.id]) {
      _proximityAlertShown[d.id] = true;
      _proximityAlertOpen = true;
      if (_simInterval) { clearInterval(_simInterval); _simInterval = 'paused'; }
      showProximityAlert(i + 1, d.placeName || d.formatted, i);
      break;
    }
  }
}

function showProximityAlert(num, label, deliveryIdx) {
  const existing = document.getElementById('proximity-alert');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.id = 'proximity-alert';
  const esc = s => { const el = document.createElement('div'); el.appendChild(document.createTextNode(s || '')); return el.innerHTML; };
  const currentD = state.deliveries[state.navIndex];
  const currentLabel = currentD ? esc(currentD.placeName || currentD.formatted) : '';
  div.innerHTML = `
    <div class="prox-current">En cours : <b>${state.navIndex + 1}</b> — ${currentLabel}</div>
    <div class="prox-text">📍 Livraison <b>${num}</b> à proximité<br><span>${esc(label)}</span></div>
    <div class="prox-btns">
      <button onclick="acceptProximitySwitch(${deliveryIdx})">Livrer maintenant</button>
      <button class="prox-skip" onclick="dismissProximityAlert()">Ignorer</button>
    </div>`;
  document.body.appendChild(div);
}

function acceptProximitySwitch(idx) {
  state.navIndex = idx;
  updateNavPanel(); renderDeliveryList(); renderRouteSteps(); updateRouteProgress(); saveSession();
  openInGoogleMaps();
  dismissProximityAlert();
}

function dismissProximityAlert() {
  _proximityAlertOpen = false;
  const el = document.getElementById('proximity-alert');
  if (el) el.remove();
  if (_simMode && _simInterval === 'paused') resumeSim();
}

// ── PANNEAU DE NAVIGATION ──
function updateNavPanel() {
  const i = state.navIndex, total = state.deliveries.length;
  const stop = state.navStops[i + 1], leg = state.navLegs[i];
  const d = state.deliveries[i];

  // Adresse en cours
  document.getElementById('nav-badge').textContent = i + 1;
  document.getElementById('nav-dest').textContent = (d && d.placeName) || stop.formatted;
  document.getElementById('nav-meta').textContent = leg.distance.text + ' · ' + leg.duration.text;
  document.getElementById('nav-meta').classList.remove('nav-arrived');

  // Status clignotant
  const statusEl = document.getElementById('nav-status');
  statusEl.textContent = 'En cours de livraison';
  statusEl.classList.remove('arrived');

  // Progression
  document.getElementById('nav-progress-text').textContent = (i + 1) + ' / ' + total;
  document.getElementById('nav-progress-fill').style.width = ((i + 1) / total * 100) + '%';

  // Bloc suivant + bouton
  const nextBlock = document.getElementById('nav-next-block');
  const btnNext = document.getElementById('btn-nav-next');
  if (i < total - 1) {
    const nextStop = state.navStops[i + 2];
    const nextD = state.deliveries[i + 1];
    const nextName = (nextD && nextD.placeName) || nextStop.formatted;
    const nextShort = nextName.length > 35 ? nextName.substring(0, 32) + '...' : nextName;
    nextBlock.style.display = '';
    document.getElementById('nav-next-badge').textContent = i + 2;
    document.getElementById('nav-next-dest').textContent = nextName;
    btnNext.innerHTML = 'Suivant ▸ <span style="font-size:.65rem;opacity:.7;display:block;font-weight:400;margin-top:2px">' + nextShort + '</span>';
  } else {
    nextBlock.style.display = 'none';
    btnNext.innerHTML = 'Terminé ✓';
  }

  // Animation du marker de destination
  state.markers.forEach((m, idx) => m.setAnimation(idx === i + 1 ? google.maps.Animation.BOUNCE : null));
  setTimeout(() => state.markers.forEach(m => m.setAnimation(null)), 1500);
}

function nextNavStop() {
  if (state.navIndex >= state.deliveries.length - 1) {
    state.navIndex = state.deliveries.length;
    state._tourComplete = true;
    updateRouteProgress();
    exitNavigation(); renderRouteSteps();
    showStatus('success', 'Tournée terminée ! Vérifiez vos livraisons puis réinitialisez.');
    saveSession(); return;
  }
  state.navIndex++; state.followMode = true;
  updateNavPanel(); renderDeliveryList(); renderRouteSteps(); updateRouteProgress(); saveSession();
}

function openInGoogleMaps() {
  if (!state.navStops || state.navIndex + 1 >= state.navStops.length) return;
  const dest = state.navStops[state.navIndex + 1];
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`, '_blank');
}

function showNavLaunchToast() {
  const existing = document.getElementById('nav-launch-toast');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.id = 'nav-launch-toast';
  div.innerHTML = `
    <span class="nlt-icon">🗺️</span>
    <div class="nlt-body">
      <div class="nlt-title">Navigation lancée dans Google Maps</div>
      <div class="nlt-sub">Revenez sur CarGo pour valider la livraison</div>
    </div>
    <button class="nlt-close" onclick="document.getElementById('nav-launch-toast').remove()">✕</button>
    <div class="nlt-bar"></div>`;
  document.body.appendChild(div);
  setTimeout(() => { if (div.parentNode) div.remove(); }, 7000);
}

// ── WAKE LOCK (écran toujours allumé) ──
function requestWakeLock() {
  if ('wakeLock' in navigator) navigator.wakeLock.request('screen').then(l => state.wakeLock = l).catch(() => {});
}

// Réacquisition du wake lock et détection auto de retour
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.watchId !== null) {
    requestWakeLock();
    // Toast de retour — rappel de valider la livraison
    if (state.navStops && state.navIndex < state.deliveries.length) showNavLaunchToast();
    // Détection automatique de retour depuis Google Maps
    const arCheck = document.getElementById('autoreturn-check');
    if (arCheck && arCheck.checked && state.navStops && state.navIndex < state.deliveries.length) {
      navigator.geolocation.getCurrentPosition(pos => {
        const dest = state.navStops[state.navIndex + 1];
        const dist = haversine({ lat: pos.coords.latitude, lng: pos.coords.longitude }, dest);
        if (dist < 100) {
          if (confirm('Vous êtes arrivé à destination. Passer à la livraison suivante ?')) {
            nextNavStop();
          }
        }
      }, () => {}, { enableHighAccuracy: true, timeout: 5000 });
    }
  }
});

function centerOnMe() {
  state.followMode = true;
  if (state.posMarker) { state.map.panTo(state.posMarker.getPosition()); state.map.setZoom(Math.max(state.map.getZoom(), 16)); }
}

// ── PROGRESSION VISUELLE (markers livrés en vert) ──
function updateRouteProgress() {
  if (!state.navStops || !state.navLegs) return;
  state.markers.forEach((m, idx) => {
    if (idx === 0) return;
    if (idx <= state.navIndex) {
      const pos = m.getPosition();
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="48" viewBox="0 0 38 48">
        <path d="M19 46 C19 46 2 28 2 17 A17 17 0 1 1 36 17 C36 28 19 46 19 46Z" fill="rgba(0,0,0,.25)" transform="translate(1,1)"/>
        <path d="M19 46 C19 46 2 28 2 17 A17 17 0 1 1 36 17 C36 28 19 46 19 46Z" fill="#22c55e"/>
        <circle cx="19" cy="17" r="11" fill="rgba(255,255,255,.92)"/>
        <text x="19" y="22" text-anchor="middle" fill="#22c55e" font-family="Arial,sans-serif" font-weight="800" font-size="14">✓</text></svg>`;
      m.setIcon({ url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(38, 48), anchor: new google.maps.Point(19, 48) });
    }
  });
  // Tracé vert pour les legs terminés
  if (state._completedPoly) state._completedPoly.setMap(null);
  if (state.navIndex > 0) {
    const completedPath = [];
    for (let i = 0; i < state.navIndex; i++) {
      if (state.navLegs[i] && state.navLegs[i].steps) {
        state.navLegs[i].steps.forEach(step => { step.path.forEach(p => completedPath.push(p)); });
      }
    }
    if (completedPath.length) {
      state._completedPoly = new google.maps.Polyline({
        path: completedPath, map: state.map,
        strokeColor: '#22c55e', strokeWeight: 6, strokeOpacity: 0.9, zIndex: 10,
        icons: [{ icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2.5, strokeColor: '#fff', strokeWeight: 1, fillColor: '#fff', fillOpacity: 0.9 }, offset: '0', repeat: '80px' }]
      });
    }
  }
}

function exitNavigation() {
  stopSim();
  clearTimeout(state._recenterTimer);
  if (state.wakeLock) { state.wakeLock.release(); state.wakeLock = null; }
  if (state.watchId !== null) { if (!_simMode) navigator.geolocation.clearWatch(state.watchId); state.watchId = null; }
  if (state.posMarker) { state.posMarker.setMap(null); state.posMarker = null; }
  if (state.posCircle) { state.posCircle.setMap(null); state.posCircle = null; }
  document.getElementById('nav-panel').classList.remove('visible');
  document.getElementById('btn-nav-start').classList.add('visible');
  state.markers.forEach(m => m.setAnimation(null));
  saveSession();
}
