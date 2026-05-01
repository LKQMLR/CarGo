/* ══════════════════════════════════════════
   CarGo — Affichage de l'itinéraire
   Tracé, résultats, étapes, gain de temps
   ══════════════════════════════════════════ */

// Couleurs par secteur pour les markers
const SECTOR_COLS = { 0: '#ffffff', 1: '#3b82f6', 2: '#0d9488', 3: '#d97706', 4: '#db2777', 5: '#7c3aed' };

// ── LABEL DESTINATION SUR CARTE APERÇU ──
function makeDestLabel(position, text, map) {
  const overlay = new google.maps.OverlayView();
  let div;
  overlay.onAdd = function() {
    div = document.createElement('div');
    div.style.cssText = 'position:absolute;background:rgba(15,15,26,0.82);padding:2px 6px;border-radius:4px;font-size:9px;font-weight:600;color:#e2e8f0;white-space:nowrap;pointer-events:none;transform:translate(-50%,8px);max-width:90px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 4px rgba(0,0,0,.3);opacity:0;transition:opacity .25s';
    div.textContent = text;
    overlay.getPanes().overlayLayer.appendChild(div);
  };
  overlay.draw = function() {
    const p = overlay.getProjection().fromLatLngToDivPixel(position);
    if (p && div) { div.style.left = p.x + 'px'; div.style.top = p.y + 'px'; }
  };
  overlay.onRemove = function() { if (div) { div.parentNode?.removeChild(div); div = null; } };
  overlay.setOpacity = function(o) { if (div) { div.style.opacity = o; div.style.display = o > 0 ? 'block' : 'none'; } };
  overlay.setMap(map);
  return overlay;
}

// ── TRACÉ DE L'ITINÉRAIRE ──
function displayRoute(stops) {
  setUIBusy(true); showStatus('loading', 'Tracé...');
  clearMarkers();
  if (state.startPoint?.marker) { state.startPoint.marker.setMap(null); state.startPoint.marker = null; }
  state.deliveries.forEach(d => { if (d.marker) { d.marker.setMap(null); d.marker = null; } });

  // Découpage en lots de max 25 points (origin + 23 waypoints + destination)
  const batches = [];
  const MAX_WP = 23;
  for (let i = 0; i < stops.length - 1; i += MAX_WP) {
    const chunk = stops.slice(i, i + MAX_WP + 1);
    if (chunk.length < 2) break;
    batches.push(chunk);
  }

  let allLegs = [];
  let totalDist = 0, totalDur = 0;
  let completed = 0;
  const allResults = [];

  // Timeout global 20s pour le tracé
  const routeTimeout = setTimeout(() => {
    if (completed < batches.length) {
      showStatus('error', 'Le tracé a pris trop de temps. Réessayez.');
      setUIBusy(false);
    }
  }, 20000);

  batches.forEach((batch, bIdx) => {
    const origin = { lat: batch[0].lat, lng: batch[0].lng };
    const dest = { lat: batch[batch.length - 1].lat, lng: batch[batch.length - 1].lng };
    const wps = batch.slice(1, -1).map(s => ({ location: { lat: s.lat, lng: s.lng }, stopover: true }));

    state.directionsService.route({
      origin, destination: dest, waypoints: wps, optimizeWaypoints: false,
      travelMode: google.maps.TravelMode.DRIVING, unitSystem: google.maps.UnitSystem.METRIC, language: 'fr',
    }, (result, status) => {
      if (status !== 'OK') { clearTimeout(routeTimeout); showStatus('error', 'Erreur itinéraire : ' + status); setUIBusy(false); return; }
      allResults[bIdx] = result;
      completed++;
      if (completed < batches.length) return;
      clearTimeout(routeTimeout);

      // Tous les lots terminés — combiner les résultats
      allResults.forEach(r => {
        const legs = r.routes[0].legs;
        legs.forEach(l => { totalDist += l.distance.value; totalDur += l.duration.value; });
        allLegs.push(...legs);
      });

      // Affichage sur la carte — toujours en polyline custom (pas de markers Google)
      state.directionsRenderer.setDirections({ routes: [] });
      if (state.previewRenderer) state.previewRenderer.setDirections({ routes: [] });
      const path = [];
      allResults.forEach(r => { r.routes[0].overview_path.forEach(p => path.push(p)); });
      if (state._routePoly) state._routePoly.setMap(null);
      if (state._routePolyGlow) state._routePolyGlow.setMap(null);
      if (state._routePolyPreview) state._routePolyPreview.setMap(null);
      const arrowIcon = { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2.5, strokeColor: '#fff', strokeWeight: 1, fillColor: '#fff', fillOpacity: 0.9 };
      // Halo sous le trajet principal
      state._routePolyGlow = new google.maps.Polyline({
        path, map: state.map, strokeColor: '#4f8cff', strokeWeight: 16, strokeOpacity: 0.12, zIndex: 1
      });
      state._routePoly = new google.maps.Polyline({
        path, map: state.map, strokeColor: '#4f8cff', strokeWeight: 5, strokeOpacity: 0.95,
        icons: [{ icon: arrowIcon, offset: '0', repeat: '80px' }], zIndex: 2
      });
      if (state.previewMap) {
        // Polyline aperçu : trajet complet (visuel)
        state._routePolyPreview = new google.maps.Polyline({
          path, map: state.previewMap, strokeColor: '#4f8cff', strokeWeight: 4, strokeOpacity: 1
        });
        // Bounds : trajet complet, cadrage initial puis zoom libre
        const bounds = new google.maps.LatLngBounds();
        path.forEach(p => bounds.extend(p));
        state._routeBounds = bounds;
        google.maps.event.clearListeners(state.previewMap, 'idle');
        google.maps.event.addListenerOnce(state.previewMap, 'idle', () => {
          state.previewMap.fitBounds(bounds, 20);
        });
        state.previewMap.fitBounds(bounds, 20);

        // Labels destination sous chaque marqueur de la preview — visibles seulement si zoom >= 13
        if (state._routeLabels) { state._routeLabels.forEach(l => l.setMap(null)); }
        if (state._routeLabelZoomListener) { google.maps.event.removeListener(state._routeLabelZoomListener); }
        state._routeLabels = [];
        stops.slice(1).forEach(s => {
          const short = (s.address || '').replace(/,.*$/, '').trim().substring(0, 22);
          if (short) state._routeLabels.push(makeDestLabel({ lat: s.lat, lng: s.lng }, short, state.previewMap));
        });
        state._routeLabels.forEach(l => l.setOpacity(0));
        const _syncLabelVis = () => {
          const zoom = state.previewMap.getZoom();
          // opacité 0 en dessous de zoom 11, pleine à zoom 14+
          const opacity = Math.max(0, Math.min(1, (zoom - 11) / 3));
          state._routeLabels.forEach(l => l.setOpacity(opacity));
        };
        // Attendre que fitBounds soit stabilisé avant d'activer le listener
        google.maps.event.addListenerOnce(state.previewMap, 'idle', () => {
          state._routeLabels.forEach(l => l.setOpacity(0));
          state._routeLabelZoomListener = state.previewMap.addListener('zoom_changed', _syncLabelVis);
        });
      }

      // Placer les markers
      stops.forEach((s, r) => {
        const lbl = r === 0 ? 'D' : String(r);
        const col = r === 0 ? '#22c55e' : (SECTOR_COLS[s.sector || 0] || '#4f8cff');
        const ttl = r === 0 ? 'Départ' : `Livraison ${r}`;
        const pos = { lat: s.lat, lng: s.lng };
        const mOpts = (r !== 0 && !(s.sector)) ? { textColor: '#1a1a2e', accentColor: '#1a1a2e' } : {};
        const m = createClassicMarker(pos, lbl, col, ttl, undefined, undefined, mOpts);
        state.markers.push(m);
        if (r > 0) {
          const delivery = s, rank = r;
          m.addListener('click', () => _onDeliveryMarkerClick(delivery, m, rank));
        }
        if (state.previewMap) state.previewMarkers.push(createClassicMarker(pos, lbl, col, ttl, state.previewMap, 0.65));
      });

      state.navStops = stops; state.navLegs = allLegs;
      state.deliveries.forEach((d, i) => {
        if (allLegs[i]) { d.legDist = allLegs[i].distance.text; d.legDur = allLegs[i].duration.text; }
      });
      showResults(stops, allLegs, totalDist, totalDur);

      // Calcul du gain de temps vs ordre original
      if (state._originalOrder && state._originalOrder.length > 1) {
        // Calculer la durée de l'ordre original via l'API
        const origStops = [state.startPoint, ...state._originalOrder];
        calculateRouteDuration(origStops).then(origDur => {
          const optDur = allLegs.reduce((s, l) => s + l.duration.value, 0);
          const savedMin = Math.round((origDur - optDur) / 60);
          if (savedMin > 1) {
            showStatus('success', `${state.deliveries.length} livraison(s) optimisée(s) — ~${savedMin} min gagnée(s) !`);
          } else {
            showStatus('success', `${state.deliveries.length} livraison(s) optimisée(s).`);
          }
          delete state._originalOrder;
        });
      } else {
        showStatus('success', `${state.deliveries.length} livraison(s) optimisée(s).`);
      }

      renderDeliveryList();
      document.getElementById('btn-nav-start').classList.add('visible');
      document.getElementById('nav-panel').classList.remove('visible');
      saveSession(); setUIBusy(false);
    });
  });
}

// ── CALCUL DE DURÉE POUR UN ORDRE DONNÉ ──
function calculateRouteDuration(stops) {
  return new Promise(resolve => {
    const batches = [];
    const MAX_WP = 23;
    for (let i = 0; i < stops.length - 1; i += MAX_WP) {
      const chunk = stops.slice(i, i + MAX_WP + 1);
      if (chunk.length < 2) break;
      batches.push(chunk);
    }
    let totalDur = 0, completed = 0;
    batches.forEach(batch => {
      const origin = { lat: batch[0].lat, lng: batch[0].lng };
      const dest = { lat: batch[batch.length - 1].lat, lng: batch[batch.length - 1].lng };
      const wps = batch.slice(1, -1).map(s => ({ location: { lat: s.lat, lng: s.lng }, stopover: true }));
      state.directionsService.route({
        origin, destination: dest, waypoints: wps, optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.DRIVING, language: 'fr',
      }, (result, status) => {
        if (status === 'OK') {
          result.routes[0].legs.forEach(l => { totalDur += l.duration.value; });
        }
        completed++;
        if (completed >= batches.length) resolve(totalDur);
      });
    });
  });
}

// ── RÉSUMÉ ──
function showResults(stops, legs, distM, durS) {
  const km = (distM / 1000).toFixed(1), h = Math.floor(durS / 3600), m = Math.floor((durS % 3600) / 60);
  document.getElementById('route-summary').innerHTML = `
    <div class="summary-card"><span>Distance</span><strong>${km} km</strong></div>
    <div class="summary-card"><span>Durée</span><strong>${h > 0 ? h + 'h ' + m + 'min' : m + ' min'}</strong></div>
    <div class="summary-card"><span>Arrêts</span><strong>${state.deliveries.length}</strong></div>`;
  renderRouteSteps();
  document.getElementById('results-panel').classList.add('visible');
}

// ── ÉTAPES DE L'ITINÉRAIRE ──
function renderRouteSteps() {
  if (!state.navStops || !state.navLegs) return;
  const esc = s => { const el = document.createElement('div'); el.appendChild(document.createTextNode(s || '')); return el.innerHTML; };
  const stops = state.navStops, legs = state.navLegs;
  const navActive = document.getElementById('nav-panel').classList.contains('visible') || state._tourComplete;
  const now = new Date();
  let cumSeconds = 0;

  // Carte de départ
  let html = `<li><div class="step-badge depot">D</div><div class="step-content">
    <div class="step-place-name" style="color:var(--green)">Départ</div>
    <div class="step-addr">${esc(stops[0].formatted)}</div>
  </div></li>`;

  for (let i = 0; i < legs.length; i++) {
    cumSeconds += legs[i].duration.value;
    const eta = new Date(now.getTime() + cumSeconds * 1000);
    const etaStr = eta.getHours() + 'h' + String(eta.getMinutes()).padStart(2, '0');
    const d = state.deliveries[i];
    const pn = d && d.placeName ? `<div class="step-place-name">${esc(d.placeName)}</div>` : '';
    const note = d && d.note ? `<div class="step-note">— ${esc(d.note)}</div>` : '';
    const stepClass = navActive && i < state.navIndex ? 'step-delivered' : navActive && i === state.navIndex ? 'step-current' : '';
    const sectorClass = d && d.sector ? 'sector-' + d.sector : '';
    const secCols = { 1: '#3b82f6', 2: '#0d9488', 3: '#d97706', 4: '#db2777', 5: '#7c3aed' };
    const customRing = d && d.customOrder ? 'outline:2.5px solid #a78bfa;outline-offset:2px;' : '';
    const badgeStyle = d && d.sector && secCols[d.sector] ? ` style="background:${secCols[d.sector]};${customRing}"` : d && d.customOrder ? ` style="background:linear-gradient(135deg,#a78bfa,#7c3aed)"` : '';
    const delivered = navActive && i < state.navIndex ? '<div class="step-status">Livré ✓</div>' : '';

    // Séparateur entre les étapes
    html += `<li style="list-style:none;display:flex;justify-content:center;background:none;border:none;box-shadow:none;padding:0;margin:-4px 0;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".4"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg></li>`;
    html += `<li class="${stepClass} ${sectorClass}"><div class="step-badge"${badgeStyle}>${i + 1}</div><div class="step-content">
      ${pn}<div class="step-addr">${esc(stops[i + 1].formatted)}</div>
      ${note}
      <div class="step-meta"><span>~${etaStr}</span></div>
      ${delivered}
    </div></li>`;
  }
  document.getElementById('route-steps').innerHTML = html;
}

// ── MARKER INFO (tap = scale 1.3× + InfoWindow, double-tap = cycle secteur) ──
// Le délai 250ms est indispensable : l'InfoWindow ouverte couvre le marker label,
// rendant le 2e tap invisible pour l'API Maps. Le délai laisse la fenêtre fermée
// pendant la détection du double-tap.
var _mic = { currentId: null, enlargedMarker: null, infoWindow: null, mapCloseListener: null };
var _tapTimer = null;
var _tapTargetId = null;

function _onDeliveryMarkerClick(delivery, marker, rank) {
  if (_tapTimer && _tapTargetId === delivery.id) {
    // 2e tap sur le même marker dans les 250ms → double-tap
    clearTimeout(_tapTimer); _tapTimer = null; _tapTargetId = null;
    cycleSectorFromMap(delivery.id);
    return;
  }
  // Annuler tout timer en cours (changement de marker)
  if (_tapTimer) { clearTimeout(_tapTimer); _tapTimer = null; }
  _tapTargetId = delivery.id;
  _tapTimer = setTimeout(() => {
    _tapTimer = null; _tapTargetId = null;
    showMarkerInfo(delivery, marker, rank);
  }, 250);
}

function _restoreMarkerIcon(id) {
  if (!_mic.enlargedMarker || !id) return;
  const d = state.deliveries.find(d => d.id === id);
  const idx = state.deliveries.findIndex(d => d.id === id);
  if (d && idx >= 0) {
    const sec = d.sector || 0;
    const col = SECTOR_COLS[sec];
    const opts = sec === 0 ? { textColor: '#1a1a2e', accentColor: '#1a1a2e' } : {};
    _mic.enlargedMarker.setIcon(_markerSvgIcon(String(idx + 1), col, 1, opts));
    _mic.enlargedMarker.setZIndex(500);
  }
}

function _createMarkerInfoContent(delivery, rank) {
  const sec = delivery.sector || 0;
  const secCols = [null, '#3b82f6', '#0d9488', '#d97706', '#db2877', '#7c3aed'];
  const secCol = secCols[sec];

  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:240px;box-sizing:border-box;overflow:hidden;border-radius:12px;';

  // Bande colorée en haut (secteur 1-5 uniquement)
  if (secCol) {
    const bar = document.createElement('div');
    bar.style.cssText = 'height:3px;background:' + secCol + ';';
    wrap.appendChild(bar);
  }

  const inner = document.createElement('div');
  inner.style.cssText = 'padding:11px 13px;';
  wrap.appendChild(inner);

  // Adresse
  const mainText = delivery.placeName || delivery.formatted || delivery.address || '';
  const subText = delivery.placeName
    ? (delivery.formatted || delivery.address || '').replace(/,\s*\d{5}.*$/, '').trim()
    : '';
  const addrEl = document.createElement('div');
  addrEl.style.cssText = 'font-size:12px;font-weight:700;color:#e2e8f0;line-height:1.4;margin-bottom:' + (subText ? '2px' : '5px') + ';';
  addrEl.textContent = mainText.length > 46 ? mainText.slice(0, 44) + '…' : mainText;
  inner.appendChild(addrEl);
  if (subText) {
    const subEl = document.createElement('div');
    subEl.style.cssText = 'font-size:11px;color:#94a3b8;margin-bottom:5px;';
    subEl.textContent = subText.length > 46 ? subText.slice(0, 44) + '…' : subText;
    inner.appendChild(subEl);
  }

  // Ligne meta : Sx + dist/temps
  const hasMeta = sec > 0 || (delivery.legDist && delivery.legDur);
  if (hasMeta) {
    const meta = document.createElement('div');
    meta.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:' + (delivery.note ? '5px' : '9px') + ';';
    if (sec > 0 && secCol) {
      const sl = document.createElement('span');
      sl.style.cssText = 'font-size:11px;font-weight:800;color:' + secCol + ';letter-spacing:.3px;';
      sl.textContent = 'S' + sec;
      meta.appendChild(sl);
    }
    if (delivery.legDist && delivery.legDur) {
      const dt = document.createElement('span');
      dt.style.cssText = 'font-size:10px;color:#64748b;';
      dt.textContent = delivery.legDist + ' · ' + delivery.legDur;
      meta.appendChild(dt);
    }
    inner.appendChild(meta);
  } else if (!delivery.note) {
    inner.style.paddingBottom = '9px';
  }

  if (delivery.note) {
    const noteEl = document.createElement('div');
    noteEl.style.cssText = 'font-size:11px;color:#fbbf24;font-style:italic;margin-bottom:9px;line-height:1.3;';
    noteEl.textContent = delivery.note;
    inner.appendChild(noteEl);
  }

  // Séparateur
  const hr = document.createElement('div');
  hr.style.cssText = 'height:1px;background:rgba(255,255,255,.08);margin:0 0 9px;';
  inner.appendChild(hr);

  // Boutons
  const btns = document.createElement('div');
  btns.style.cssText = 'display:flex;gap:6px;align-items:center;';

  // Cadenas — icône seule, carré compact
  const lockBtn = document.createElement('button');
  const isLocked = delivery.locked;
  lockBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;width:30px;height:30px;flex-shrink:0;border-radius:8px;' +
    'border:1px solid ' + (isLocked ? 'rgba(251,191,36,.35)' : 'rgba(255,255,255,.12)') + ';' +
    'background:' + (isLocked ? 'rgba(251,191,36,.12)' : 'rgba(255,255,255,.06)') + ';' +
    'color:' + (isLocked ? '#fbbf24' : '#64748b') + ';cursor:pointer;';
  lockBtn.title = isLocked ? 'Libérer cette position' : 'Fixer cette position';
  lockBtn.innerHTML = isLocked
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';
  lockBtn.addEventListener('click', () => _toggleLockFromMap(delivery.id));
  btns.appendChild(lockBtn);

  // Voir dans la liste
  const listBtn = document.createElement('button');
  listBtn.style.cssText = 'display:flex;align-items:center;gap:5px;padding:0 10px;height:30px;border-radius:8px;flex:1;' +
    'border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);' +
    'color:#e2e8f0;font-size:11px;font-weight:600;cursor:pointer;line-height:1;';
  listBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">' +
    '<line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/>' +
    '<circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none"/>' +
    '<circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none"/>' +
    '<circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>' +
    '<span>Voir dans la liste</span>';
  listBtn.addEventListener('click', () => _scrollToDelivery(delivery.id));
  btns.appendChild(listBtn);

  inner.appendChild(btns);
  return wrap;
}

function showMarkerInfo(delivery, marker, rank) {
  if (_mic.enlargedMarker && _mic.currentId !== delivery.id) {
    _restoreMarkerIcon(_mic.currentId);
    _mic.enlargedMarker = null;
  }
  if (_mic.infoWindow) { _mic.infoWindow.close(); _mic.infoWindow = null; }

  _mic.currentId = delivery.id;

  const sec = delivery.sector || 0;
  const col = SECTOR_COLS[sec];
  const opts = sec === 0 ? { textColor: '#1a1a2e', accentColor: '#1a1a2e' } : {};
  marker.setIcon(_markerSvgIcon(String(rank), col, 1.3, opts));
  marker.setZIndex(2000);
  _mic.enlargedMarker = marker;

  const secCols = [null, '#3b82f6', '#0d9488', '#d97706', '#db2877', '#7c3aed'];
  _mic.infoWindow = new google.maps.InfoWindow({ content: _createMarkerInfoContent(delivery, rank) });
  if (sec > 0 && secCols[sec]) {
    google.maps.event.addListenerOnce(_mic.infoWindow, 'domready', () => {
      const iw = document.querySelector('.gm-style-iw-c');
      if (iw) iw.style.borderColor = secCols[sec];
    });
  }
  _mic.infoWindow.open(state.map, marker);

  state.map.panTo({ lat: delivery.lat, lng: delivery.lng });

  if (_mic.mapCloseListener) google.maps.event.removeListener(_mic.mapCloseListener);
  _mic.mapCloseListener = state.map.addListener('click', closeMarkerInfo);
}

function closeMarkerInfo() {
  if (_tapTimer) { clearTimeout(_tapTimer); _tapTimer = null; _tapTargetId = null; }
  _restoreMarkerIcon(_mic.currentId);
  if (_mic.infoWindow) { _mic.infoWindow.close(); _mic.infoWindow = null; }
  _mic.enlargedMarker = null;
  _mic.currentId = null;
  if (_mic.mapCloseListener) { google.maps.event.removeListener(_mic.mapCloseListener); _mic.mapCloseListener = null; }
}

function _toggleLockFromMap(id) {
  toggleLock(id);
  const d = state.deliveries.find(d => d.id === id);
  const marker = _mic.enlargedMarker;
  const idx = state.deliveries.findIndex(d => d.id === id);
  if (d && marker && idx >= 0) {
    if (_mic.infoWindow) { _mic.infoWindow.close(); _mic.infoWindow = null; }
    _mic.infoWindow = new google.maps.InfoWindow({ content: _createMarkerInfoContent(d, idx + 1) });
    _mic.infoWindow.open(state.map, marker);
  }
}

function _scrollToDelivery(id) {
  closeMarkerInfo();
  const sidebar = document.getElementById('sidebar');
  if (sidebar && sidebar.classList.contains('hidden')) sidebar.classList.remove('hidden');
  setTimeout(() => {
    const el = document.querySelector('[data-id="' + id + '"]');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'box-shadow .3s';
      el.style.boxShadow = '0 0 0 2px #4f8cff';
      setTimeout(() => { el.style.boxShadow = ''; }, 1500);
    }
  }, 300);
}
