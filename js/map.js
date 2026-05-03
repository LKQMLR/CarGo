/* ══════════════════════════════════════════
   CarGo — Carte & Markers
   Création de markers modernes, nettoyage
   ══════════════════════════════════════════ */

// ── GÉNÉRATION DE L'ICÔNE SVG ──
// inverted=true → fond blanc, bordure noire, chiffre noir (marqueurs sans secteur)
function makeMarkerIcon(label, color, scale, inverted) {
  const s = scale || 1;
  const fontSize = Math.round((label.length > 2 ? 12 : label.length > 1 ? 14 : 16) * s);
  const tagH = Math.round(32 * s);
  const lineH = Math.round(16 * s);
  const tagW = Math.round((label.length > 2 ? 46 : label.length > 1 ? 38 : 34) * s);
  const tagR = Math.round(6 * s);
  const lineW = Math.round(2 * s);
  const sw = Math.round(2.5 * s);
  const outerSw = sw + Math.round(4 * s);
  const pad = Math.ceil(outerSw / 2) + 1;
  const totalW = tagW + Math.round(10 * s) + pad * 2;
  const totalH = tagH + lineH + Math.round(4 * s) + pad;
  const cx = totalW / 2;
  const tagX = (totalW - tagW) / 2;
  const shadowOff = Math.round(3 * s);
  const ty = pad;

  const borderCol  = inverted ? '#1a1a2e' : color;
  const fillCol    = inverted ? '#ffffff' : color;
  const innerBorder= inverted ? '#1a1a2e' : '#fff';
  const textCol    = inverted ? '#1a1a2e' : '#fff';
  const lineCol    = inverted ? '#1a1a2e' : color;
  const dotOuter   = inverted ? '#1a1a2e' : '#fff';
  const dotInner   = inverted ? '#ffffff' : color;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
    <rect x="${tagX + shadowOff}" y="${ty + shadowOff + 1}" width="${tagW}" height="${tagH}" rx="${tagR}" fill="rgba(0,0,0,.25)"/>
    <rect x="${tagX}" y="${ty}" width="${tagW}" height="${tagH}" rx="${tagR}" fill="none" stroke="${borderCol}" stroke-width="${outerSw}"/>
    <rect x="${tagX}" y="${ty}" width="${tagW}" height="${tagH}" rx="${tagR}" fill="${fillCol}" stroke="${innerBorder}" stroke-width="${sw}"/>
    <text x="${cx}" y="${ty + tagH / 2 + fontSize * 0.36}" text-anchor="middle" fill="${textCol}" font-family="Arial,sans-serif" font-weight="800" font-size="${fontSize}">${label}</text>
    <line x1="${cx}" y1="${ty + tagH}" x2="${cx}" y2="${ty + tagH + lineH}" stroke="${lineCol}" stroke-width="${lineW + Math.round(1 * s)}" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${ty + tagH + lineH}" r="${Math.round(3.5 * s)}" fill="${dotOuter}"/>
    <circle cx="${cx}" cy="${ty + tagH + lineH}" r="${Math.round(1.5 * s)}" fill="${dotInner}"/>
  </svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(totalW, totalH),
    anchor: new google.maps.Point(cx, ty + tagH + lineH)
  };
}

// ── MARKER MODERNE : étiquette arrondie + trait + point ──
function createClassicMarker(position, label, color, title, targetMap, scale, inverted) {
  return new google.maps.Marker({
    position, map: targetMap || state.map, title,
    icon: makeMarkerIcon(label, color, scale, inverted),
    zIndex: label === 'D' ? 1000 : 500
  });
}

// ── NETTOYAGE DES MARKERS ──
function clearMarkers() {
  state.markers.forEach(m => m.setMap(null)); state.markers = [];
  state.previewMarkers.forEach(m => m.setMap(null)); state.previewMarkers = [];
}
