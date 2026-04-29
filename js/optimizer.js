/* ══════════════════════════════════════════
   CarGo — Optimisation de tournée
   TSP, 2-opt, Google Directions, secteurs
   ══════════════════════════════════════════ */

// ── HAVERSINE (distance à vol d'oiseau) ──
function haversine(a, b) {
  const R = 6371000, toR = x => x * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLon = toR(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function buildDistanceMatrix(pts) {
  return pts.map((a, i) => pts.map((b, j) => i === j ? 0 : haversine(a, b)));
}

// ── NEAREST NEIGHBOR + 2-OPT ──
function nearestNeighborTSP(mx, start = 0) {
  const n = mx.length, vis = new Array(n).fill(false), tour = [start]; vis[start] = true;
  for (let s = 1; s < n; s++) {
    const c = tour[tour.length - 1]; let nn = -1, nd = Infinity;
    for (let j = 0; j < n; j++) { if (!vis[j] && mx[c][j] < nd) { nn = j; nd = mx[c][j]; } }
    if (nn === -1) break; vis[nn] = true; tour.push(nn);
  }
  return twoOpt(tour, mx);
}

function twoOpt(tour, mx) {
  const n = tour.length;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = tour[i - 1], b = tour[i], c = tour[j], d = j + 1 < n ? tour[j + 1] : null;
        const oldDist = mx[a][b] + (d !== null ? mx[c][d] : 0);
        const newDist = mx[a][c] + (d !== null ? mx[b][d] : 0);
        if (newDist < oldDist - 1e-10) {
          let left = i, right = j;
          while (left < right) { const tmp = tour[left]; tour[left] = tour[right]; tour[right] = tmp; left++; right--; }
          improved = true;
        }
      }
    }
  }
  return tour;
}

// ── GOOGLE DIRECTIONS OPTIMIZE (avec timeout) ──
// target : point optionnel vers lequel orienter la fin du trajet (centroïde du secteur suivant)
function googleOptimize(origin, deliveries, target) {
  return new Promise((resolve) => {
    let done = false;
    // Timeout 15s — fallback local si Google ne répond pas
    const timer = setTimeout(() => {
      if (done) return; done = true;
      const all = [origin, ...deliveries];
      const tour = nearestNeighborTSP(buildDistanceMatrix(all), 0);
      resolve(tour.slice(1).map(i => all[i]));
    }, 15000);

    // Destination : point le plus proche du secteur suivant (si connu),
    // sinon le plus éloigné de l'origine (route linéaire classique)
    let destIdx = 0;
    if (target) {
      let minDist = Infinity;
      deliveries.forEach((d, i) => {
        const dist = haversine(target, d);
        if (dist < minDist) { minDist = dist; destIdx = i; }
      });
    } else {
      let maxDist = 0;
      deliveries.forEach((d, i) => {
        const dist = haversine(origin, d);
        if (dist > maxDist) { maxDist = dist; destIdx = i; }
      });
    }
    const dest = deliveries[destIdx];
    const others = deliveries.filter((_, i) => i !== destIdx);
    const wps = others.map(d => ({ location: { lat: d.lat, lng: d.lng }, stopover: true }));
    state.directionsService.route({
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: dest.lat, lng: dest.lng },
      waypoints: wps, optimizeWaypoints: true,
      travelMode: google.maps.TravelMode.DRIVING, language: 'fr',
    }, (result, status) => {
      if (done) return; done = true; clearTimeout(timer);
      if (status === 'OK') {
        const order = result.routes[0].waypoint_order;
        const reordered = order.map(i => others[i]);
        reordered.push(dest);
        resolve(reordered);
      } else {
        // Fallback local
        const all = [origin, ...deliveries];
        const tour = nearestNeighborTSP(buildDistanceMatrix(all), 0);
        resolve(tour.slice(1).map(i => all[i]));
      }
    });
  });
}

// ── OPTIMISATION PAR SEGMENT (batching >23 waypoints) ──
// target : point vers lequel orienter la fin (passé au dernier lot uniquement)
async function optimizeSegment(origin, deliveries, target) {
  if (deliveries.length <= 1) return deliveries;
  if (deliveries.length <= 23) return await googleOptimize(origin, deliveries, target);
  // >23 : découpage en lots chaînés — seul le dernier lot reçoit le target
  const batches = [];
  for (let i = 0; i < deliveries.length; i += 23) batches.push(deliveries.slice(i, i + 23));
  let result = [], prevEnd = origin;
  for (let bi = 0; bi < batches.length; bi++) {
    const batchTarget = bi === batches.length - 1 ? target : null;
    const opt = await googleOptimize(prevEnd, batches[bi], batchTarget);
    result.push(...opt);
    prevEnd = opt[opt.length - 1];
  }
  return result;
}

// ── OPTIMISATION PRINCIPALE ──
let _optimizeLocked = false;
async function optimizeRoute() {
  if (_optimizeLocked) return;
  _optimizeLocked = true;
  if (!state.startPoint) { _optimizeLocked = false; return showStatus('error', 'Définissez un point de départ.'); }
  if (!state.deliveries.length) { _optimizeLocked = false; return showStatus('error', 'Ajoutez au moins une adresse.'); }

  // Sauvegarder la session AVANT l'optimisation (protection contre perte)
  saveSession();
  const backupDeliveries = state.deliveries.map(d => ({ ...d }));

  setUIBusy(true); showStatus('loading', 'Optimisation...');
  document.getElementById('results-panel').classList.remove('visible');

  if (state.deliveries.length === 1) {
    displayRoute([state.startPoint, state.deliveries[0]]);
    _optimizeLocked = false;
    return;
  }

  try {

  // Sauvegarder l'ordre original pour comparaison
  const originalOrder = [...state.deliveries];
  const hasSectors = state.deliveries.some(d => d.sector);

  // Les lockés sont des murs fixes — on optimise les segments entre eux
  // Découper la liste en segments séparés par les lockés
  const segments = []; // { items: [...], insertAt: number }
  let currentSegment = [];
  const finalResult = new Array(state.deliveries.length);

  state.deliveries.forEach((d, i) => {
    if (d.locked) {
      if (currentSegment.length) segments.push({ items: currentSegment, insertAt: i - currentSegment.length });
      currentSegment = [];
      finalResult[i] = d; // position fixe
    } else {
      currentSegment.push(d);
    }
  });
  if (currentSegment.length) segments.push({ items: currentSegment, insertAt: state.deliveries.length - currentSegment.length });

  // Optimiser chaque segment indépendamment
  let prevEnd = state.startPoint;
  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];

    // Trouver le point de départ pour ce segment (dernier locké avant, ou startPoint)
    for (let b = seg.insertAt - 1; b >= 0; b--) {
      if (finalResult[b]) { prevEnd = finalResult[b]; break; }
    }

    let optimized;
    if (hasSectors && seg.items.length > 1) {
      // Optimiser par secteur dans ce segment
      const groups = {};
      seg.items.forEach(d => {
        const s = d.sector || 0;
        if (!groups[s]) groups[s] = [];
        groups[s].push(d);
      });
      const sectorOrder = [1, 2, 3, 4, 5].filter(s => groups[s]);
      if (groups[0]) sectorOrder.push(0);

      optimized = [];
      let segPrev = prevEnd;
      for (let si2 = 0; si2 < sectorOrder.length; si2++) {
        const s = sectorOrder[si2];
        const nextS = sectorOrder[si2 + 1];
        // Centroïde du secteur suivant → orienter la fin du secteur courant vers lui
        let nextCenter = null;
        if (nextS !== undefined && groups[nextS]) {
          const pts = groups[nextS];
          nextCenter = {
            lat: pts.reduce((sum, d) => sum + d.lat, 0) / pts.length,
            lng: pts.reduce((sum, d) => sum + d.lng, 0) / pts.length,
          };
        }
        const opt = await optimizeSegment(segPrev, groups[s], nextCenter);
        optimized.push(...opt);
        segPrev = opt[opt.length - 1];
      }
    } else if (seg.items.length > 1) {
      optimized = await optimizeSegment(prevEnd, seg.items);
    } else {
      optimized = seg.items;
    }

    // Insérer les optimisés dans les trous
    let oi = 0;
    for (let i = seg.insertAt; oi < optimized.length && i < finalResult.length; i++) {
      if (!finalResult[i]) finalResult[i] = optimized[oi++];
    }
  }

  state.deliveries = finalResult.filter(Boolean);
  state.deliveries.forEach(d => { if (!d.locked) d.customOrder = false; });
  state._originalOrder = originalOrder;
  renderDeliveryList();
  displayRoute([state.startPoint, ...state.deliveries]);
  saveSession();
  _optimizeLocked = false;

  } catch (err) {
    // Restaurer les adresses en cas d'erreur
    state.deliveries = backupDeliveries;
    renderDeliveryList();
    saveSession();
    showStatus('error', 'Erreur d\'optimisation. Vos adresses ont été conservées.');
    setUIBusy(false);
    _optimizeLocked = false;
  }
}
