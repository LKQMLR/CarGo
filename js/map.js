/* ══════════════════════════════════════════
   CarGo — Carte & Markers
   Création de markers modernes, nettoyage
   ══════════════════════════════════════════ */

// ── Compteur unique pour les dégradés SVG ──
let _markerGradId = 0;

// ── MARKER MODERNE : étiquette arrondie + trait + point ──
function createClassicMarker(position, label, color, title, targetMap, scale) {
  const isStart = label === 'D';
  const s = scale || 1;

  // Dimensions
  const fontSize = Math.round((label.length > 2 ? 12 : label.length > 1 ? 14 : 16) * s);
  const tagH = Math.round(32 * s);
  const lineH = Math.round(16 * s);
  const totalH = tagH + lineH + Math.round(4 * s);
  const tagW = Math.round((label.length > 2 ? 46 : label.length > 1 ? 38 : 34) * s);
  const totalW = tagW + Math.round(10 * s);
  const cx = totalW / 2;
  const tagR = Math.round(6 * s);
  const lineW = Math.round(2 * s);
  const tagX = (totalW - tagW) / 2;
  const shadowOff = Math.round(3 * s);
  const sw = Math.round(3.5 * s);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
    <!-- Ombre portée -->
    <rect x="${tagX + shadowOff}" y="${shadowOff + 1}" width="${tagW}" height="${tagH}" rx="${tagR}" fill="rgba(0,0,0,.35)"/>
    <!-- Étiquette avec contour blanc -->
    <rect x="${tagX}" y="0" width="${tagW}" height="${tagH}" rx="${tagR}" fill="${color}" stroke="#fff" stroke-width="${sw}"/>
    <!-- Numéro -->
    <text x="${cx}" y="${tagH / 2 + fontSize * 0.36}" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-weight="800" font-size="${fontSize}">${label}</text>
    <!-- Trait -->
    <line x1="${cx}" y1="${tagH}" x2="${cx}" y2="${tagH + lineH}" stroke="${color}" stroke-width="${lineW + Math.round(1 * s)}" stroke-linecap="round"/>
    <!-- Point -->
    <circle cx="${cx}" cy="${tagH + lineH}" r="${Math.round(3.5 * s)}" fill="#fff"/>
    <circle cx="${cx}" cy="${tagH + lineH}" r="${Math.round(1.5 * s)}" fill="${color}"/>
  </svg>`;

  return new google.maps.Marker({
    position, map: targetMap || state.map, title,
    icon: {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(totalW, totalH),
      anchor: new google.maps.Point(cx, tagH + lineH)
    },
    zIndex: isStart ? 1000 : 500
  });
}

// ── NETTOYAGE DES MARKERS ──
function clearMarkers() {
  state.markers.forEach(m => m.setMap(null)); state.markers = [];
  state.previewMarkers.forEach(m => m.setMap(null)); state.previewMarkers = [];
}
