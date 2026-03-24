/* ══════════════════════════════════════════
   CarGo — Carte & Markers
   Création de markers SVG, nettoyage
   ══════════════════════════════════════════ */

// ── MARKER SVG PERSONNALISÉ ──
function createClassicMarker(position, label, color, title, targetMap, scale) {
  const isStart = label === 'D';
  const s = scale || 1;
  const size = Math.round((isStart ? 42 : 38) * s);
  const h = Math.round((isStart ? 52 : 48) * s);
  const cx = size / 2, cy = Math.round(17 * s), r = Math.round(11 * s);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${h}" viewBox="0 0 ${size} ${h}">
    <path d="M${cx} ${h-2} C${cx} ${h-2} 2 ${h-20} 2 ${cy} A${cx-2} ${cx-2} 0 1 1 ${size-2} ${cy} C${size-2} ${h-20} ${cx} ${h-2} ${cx} ${h-2}Z"
      fill="rgba(0,0,0,.25)" transform="translate(1,1)"/>
    <path d="M${cx} ${h-2} C${cx} ${h-2} 2 ${h-20} 2 ${cy} A${cx-2} ${cx-2} 0 1 1 ${size-2} ${cy} C${size-2} ${h-20} ${cx} ${h-2} ${cx} ${h-2}Z"
      fill="${color}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,255,255,.92)"/>
    <text x="${cx}" y="${cy + 4.5 * s}" text-anchor="middle" fill="${color}" font-family="Arial,sans-serif" font-weight="800"
      font-size="${Math.round((label.length > 1 ? 10 : 13) * s)}">${label}</text></svg>`;
  return new google.maps.Marker({
    position, map: targetMap || state.map, title,
    icon: {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(size, h),
      anchor: new google.maps.Point(cx, h)
    },
    zIndex: isStart ? 1000 : 500
  });
}

// ── NETTOYAGE DES MARKERS ──
function clearMarkers() {
  state.markers.forEach(m => m.setMap(null)); state.markers = [];
  state.previewMarkers.forEach(m => m.setMap(null)); state.previewMarkers = [];
}
