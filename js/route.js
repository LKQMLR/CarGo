/* ══════════════════════════════════════════
   CarGo — Affichage de l'itinéraire
   Tracé, résultats, étapes, gain de temps
   ══════════════════════════════════════════ */

// Couleurs par secteur pour les markers
const SECTOR_COLS = { 0: '#8896a7', 1: '#3b82f6', 2: '#0d9488', 3: '#d97706', 4: '#db2777', 5: '#7c3aed' };

// ── LABEL DESTINATION SUR CARTE APERÇU ──
function makeDestLabel(position, text, map) {
  const overlay = new google.maps.OverlayView();
  let div;
  overlay.onAdd = function() {
    div = document.createElement('div');
    div.style.cssText = 'position:absolute;background:rgba(15,15,26,0.82);padding:2px 6px;border-radius:4px;font-size:9px;font-weight:600;color:#e2e8f0;white-space:nowrap;pointer-events:none;transform:translate(-50%,8px);max-width:90px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 4px rgba(0,0,0,.3)';
    div.textContent = text;
    overlay.getPanes().overlayLayer.appendChild(div);
  };
  overlay.draw = function() {
    const p = overlay.getProjection().fromLatLngToDivPixel(position);
    if (p && div) { div.style.left = p.x + 'px'; div.style.top = p.y + 'px'; }
  };
  overlay.onRemove = function() { if (div) { div.parentNode?.removeChild(div); div = null; } };
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

        // Labels destination sous chaque marqueur de la preview
        if (state._routeLabels) { state._routeLabels.forEach(l => l.setMap(null)); }
        state._routeLabels = [];
        stops.slice(1).forEach(s => {
          const short = (s.address || '').replace(/,.*$/, '').trim().substring(0, 22);
          if (short) state._routeLabels.push(makeDestLabel({ lat: s.lat, lng: s.lng }, short, state.previewMap));
        });
      }

      // Placer les markers
      stops.forEach((s, r) => {
        const lbl = r === 0 ? 'D' : String(r);
        const col = r === 0 ? '#22c55e' : (SECTOR_COLS[s.sector || 0] || '#4f8cff');
        const ttl = r === 0 ? 'Départ' : `Livraison ${r}`;
        const pos = { lat: s.lat, lng: s.lng };
        state.markers.push(createClassicMarker(pos, lbl, col, ttl));
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
