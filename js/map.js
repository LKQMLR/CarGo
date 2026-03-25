/* ══════════════════════════════════════════
   CarGo — Carte & Markers
   Création de markers modernes, nettoyage
   ══════════════════════════════════════════ */

// ── MARKER MODERNE : étiquette arrondie + contour + ombre + trait fin ──
function createClassicMarker(position, label, color, title, targetMap, scale) {
  const isStart = label === 'D';
  const s = scale || 1;

  // Dimensions agrandies
  const fontSize = Math.round((label.length > 2 ? 11 : label.length > 1 ? 12 : 14) * s);
  const tagH = Math.round(28 * s);
  const lineH = Math.round(16 * s);
  const totalH = tagH + lineH + Math.round(4 * s);
  const tagW = Math.round((label.length > 2 ? 42 : label.length > 1 ? 34 : 30) * s);
  const totalW = tagW + Math.round(8 * s);
  const cx = totalW / 2;
  const tagR = Math.round(8 * s);
  const lineW = Math.round(2 * s);
  const tagX = (totalW - tagW) / 2;
  const shadowOff = Math.round(2 * s);
  const borderW = Math.round(1.5 * s);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
    <!-- Ombre portée -->
    <rect x="${tagX + shadowOff}" y="${shadowOff + 1}" width="${tagW}" height="${tagH}" rx="${tagR}" fill="rgba(0,0,0,.35)"/>
    <!-- Contour blanc -->
    <rect x="${tagX}" y="0" width="${tagW}" height="${tagH}" rx="${tagR}" fill="#fff"/>
    <!-- Étiquette couleur -->
    <rect x="${tagX + borderW}" y="${borderW}" width="${tagW - borderW * 2}" height="${tagH - borderW * 2}" rx="${tagR - 1}" fill="${color}"/>
    <!-- Numéro -->
    <text x="${cx}" y="${tagH / 2 + fontSize * 0.36}" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-weight="800" font-size="${fontSize}">${label}</text>
    <!-- Trait avec contour -->
    <line x1="${cx}" y1="${tagH}" x2="${cx}" y2="${tagH + lineH}" stroke="#fff" stroke-width="${lineW + Math.round(2 * s)}" stroke-linecap="round"/>
    <line x1="${cx}" y1="${tagH}" x2="${cx}" y2="${tagH + lineH}" stroke="${color}" stroke-width="${lineW}" stroke-linecap="round"/>
    <!-- Point avec contour -->
    <circle cx="${cx}" cy="${tagH + lineH}" r="${Math.round(4 * s)}" fill="#fff"/>
    <circle cx="${cx}" cy="${tagH + lineH}" r="${Math.round(2.5 * s)}" fill="${color}"/>
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
