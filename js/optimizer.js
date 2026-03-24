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

// ── GOOGLE DIRECTIONS OPTIMIZE ──
function googleOptimize(origin, deliveries) {
  return new Promise((resolve) => {
    // Point le plus éloigné comme destination (route linéaire)
    let farthestIdx = 0, farthestDist = 0;
    deliveries.forEach((d, i) => {
      const dist = haversine(origin, d);
      if (dist > farthestDist) { farthestDist = dist; farthestIdx = i; }
    });
    const dest = deliveries[farthestIdx];
    const others = deliveries.filter((_, i) => i !== farthestIdx);
    const wps = others.map(d => ({ location: { lat: d.lat, lng: d.lng }, stopover: true }));
    state.directionsService.route({
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: dest.lat, lng: dest.lng },
      waypoints: wps, optimizeWaypoints: true,
      travelMode: google.maps.TravelMode.DRIVING, language: 'fr',
    }, (result, status) => {
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
async function optimizeSegment(origin, deliveries) {
  if (deliveries.length <= 1) return deliveries;
  if (deliveries.length <= 23) return await googleOptimize(origin, deliveries);
  // >23 : découpage en lots chaînés
  const batches = [];
  for (let i = 0; i < deliveries.length; i += 23) batches.push(deliveries.slice(i, i + 23));
  let result = [], prevEnd = origin;
  for (const batch of batches) {
    const opt = await googleOptimize(prevEnd, batch);
    result.push(...opt);
    prevEnd = opt[opt.length - 1];
  }
  return result;
}

// ── OPTIMISATION PRINCIPALE ──
async function optimizeRoute() {
  if (!state.startPoint) return showStatus('error', 'Définissez un point de départ.');
  if (!state.deliveries.length) return showStatus('error', 'Ajoutez au moins une adresse.');
  setUIBusy(true); showStatus('loading', 'Optimisation...');
  document.getElementById('results-panel').classList.remove('visible');

  if (state.deliveries.length === 1) { displayRoute([state.startPoint, state.deliveries[0]]); return; }

  // Sauvegarder l'ordre original pour comparaison
  const originalOrder = [...state.deliveries];
  const hasSectors = state.deliveries.some(d => d.sector);

  if (hasSectors) {
    // Optimisation par secteur
    const groups = {};
    state.deliveries.forEach(d => {
      const s = d.sector || 0;
      if (!groups[s]) groups[s] = [];
      groups[s].push(d);
    });
    const sectorOrder = [1, 2, 3, 4, 5].filter(s => groups[s]);
    if (groups[0]) sectorOrder.push(0); // Sans secteur en dernier

    let allOptimized = [];
    let prevEnd = state.startPoint;
    for (const s of sectorOrder) {
      const sectorItems = groups[s];
      // Trouver le point d'entrée le plus proche du secteur précédent
      let closestIdx = 0, closestDist = Infinity;
      sectorItems.forEach((d, idx) => {
        if (!d.locked) {
          const dist = haversine(prevEnd, d);
          if (dist < closestDist) { closestDist = dist; closestIdx = idx; }
        }
      });
      if (!sectorItems[closestIdx].locked && closestIdx > 0) {
        const [entry] = sectorItems.splice(closestIdx, 1);
        sectorItems.unshift(entry);
      }

      const locked = sectorItems.filter(d => d.locked);
      const unlocked = sectorItems.filter(d => !d.locked);
      if (locked.length && unlocked.length) {
        const optimizedUnlocked = await optimizeSegment(prevEnd, unlocked);
        const result = [];
        let ui = 0;
        sectorItems.forEach(d => {
          if (d.locked) result.push(d);
          else if (ui < optimizedUnlocked.length) result.push(optimizedUnlocked[ui++]);
        });
        allOptimized.push(...result);
      } else if (unlocked.length) {
        allOptimized.push(...await optimizeSegment(prevEnd, unlocked));
      } else {
        allOptimized.push(...locked);
      }
      prevEnd = allOptimized[allOptimized.length - 1];
    }
    state.deliveries = allOptimized;
  } else {
    // Optimisation simple (sans secteurs)
    const hasLocked = state.deliveries.some(d => d.locked);
    if (!hasLocked) {
      state.deliveries = await optimizeSegment(state.startPoint, state.deliveries);
    } else {
      const locked = [], unlocked = [];
      state.deliveries.forEach((d, i) => {
        if (d.locked) locked.push({ d, i });
        else unlocked.push(d);
      });
      const optimizedUnlocked = await optimizeSegment(state.startPoint, unlocked);
      const result = [];
      let ui = 0;
      state.deliveries.forEach(d => {
        if (d.locked) result.push(d);
        else if (ui < optimizedUnlocked.length) result.push(optimizedUnlocked[ui++]);
      });
      state.deliveries = result;
    }
  }
  state.deliveries.forEach(d => { if (!d.locked) d.customOrder = false; });
  state._originalOrder = originalOrder;
  renderDeliveryList();
  displayRoute([state.startPoint, ...state.deliveries]);
  saveSession();
}
