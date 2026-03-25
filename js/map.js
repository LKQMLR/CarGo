/* ══════════════════════════════════════════
   CarGo — Carte & Markers
   Création de markers modernes, nettoyage
   ══════════════════════════════════════════ */

// ── MARKER MODERNE : étiquette arrondie + trait fin ──
function createClassicMarker(position, label, color, title, targetMap, scale) {
  const isStart = label === 'D';
  const s = scale || 1;

  // Dimensions
  const padH = Math.round(4 * s);
  const padW = Math.round(label.length > 1 ? 8 * s : 10 * s);
  const fontSize = Math.round((label.length > 2 ? 9 : label.length > 1 ? 10 : 12) * s);
  const tagH = Math.round(22 * s);
  const lineH = Math.round(14 * s);
  const totalH = tagH + lineH;
  const tagW = Math.round((label.length > 2 ? 34 : label.length > 1 ? 28 : 24) * s);
  const totalW = tagW + 4;
  const cx = totalW / 2;
  const tagR = Math.round(6 * s);
  const lineW = Math.round(1.5 * s);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
    <!-- Ombre -->
    <rect x="${(totalW - tagW) / 2 + 1}" y="2" width="${tagW}" height="${tagH}" rx="${tagR}" fill="rgba(0,0,0,.3)"/>
    <!-- Étiquette -->
    <rect x="${(totalW - tagW) / 2}" y="0" width="${tagW}" height="${tagH}" rx="${tagR}" fill="${color}"/>
    <!-- Numéro -->
    <text x="${cx}" y="${tagH / 2 + fontSize * 0.35}" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-weight="700" font-size="${fontSize}">${label}</text>
    <!-- Trait -->
    <line x1="${cx}" y1="${tagH}" x2="${cx}" y2="${totalH}" stroke="${color}" stroke-width="${lineW}" stroke-linecap="round"/>
    <!-- Point -->
    <circle cx="${cx}" cy="${totalH - 1}" r="${Math.round(2.5 * s)}" fill="${color}"/>
  </svg>`;

  return new google.maps.Marker({
    position, map: targetMap || state.map, title,
    icon: {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(totalW, totalH),
      anchor: new google.maps.Point(cx, totalH)
    },
    zIndex: isStart ? 1000 : 500
  });
}

// ── NETTOYAGE DES MARKERS ──
function clearMarkers() {
  state.markers.forEach(m => m.setMap(null)); state.markers = [];
  state.previewMarkers.forEach(m => m.setMap(null)); state.previewMarkers = [];
}
