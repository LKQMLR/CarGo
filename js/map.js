/* ══════════════════════════════════════════
   CarGo — Carte & Markers
   Création de markers modernes, nettoyage
   ══════════════════════════════════════════ */

// ── Compteur unique pour les dégradés SVG ──
let _markerGradId = 0;

// ── GÉNÉRATEUR D'ICÔNE SVG (réutilisable pour agrandissement dynamique) ──
// opts : { textColor: '#fff', accentColor: color } — pour secteur 0 : textColor='#1a1a2e', accentColor='#1a1a2e'
function _markerSvgIcon(label, color, scale, opts) {
  const s = scale || 1;
  const textFill = (opts && opts.textColor) || '#fff';
  const accent = (opts && opts.accentColor) || color;
  const dotOuterFill = textFill === '#fff' ? '#fff' : accent;

  const fontSize = Math.round((label.length > 2 ? 12 : label.length > 1 ? 14 : 16) * s);
  const tagH = Math.round(32 * s);
  const lineH = Math.round(16 * s);
  const tagW = Math.round((label.length > 2 ? 46 : label.length > 1 ? 38 : 34) * s);
  const tagR = Math.round(6 * s);
  const lineW = Math.round(2 * s);
  const sw = Math.round(2.5 * s);
  const outerSw = textFill === '#fff' ? sw + Math.round(4 * s) : Math.round(2 * s);
  const pad = Math.ceil(outerSw / 2) + 1;
  const totalW = tagW + Math.round(10 * s) + pad * 2;
  const totalH = tagH + lineH + Math.round(4 * s) + pad;
  const cx = totalW / 2;
  const tagX = (totalW - tagW) / 2;
  const shadowOff = Math.round(3 * s);
  const ty = pad;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
    <rect x="${tagX + shadowOff}" y="${ty + shadowOff + 1}" width="${tagW}" height="${tagH}" rx="${tagR}" fill="rgba(0,0,0,.35)"/>
    <rect x="${tagX}" y="${ty}" width="${tagW}" height="${tagH}" rx="${tagR}" fill="none" stroke="${accent}" stroke-width="${outerSw}"/>
    <rect x="${tagX}" y="${ty}" width="${tagW}" height="${tagH}" rx="${tagR}" fill="${color}" stroke="${textFill}" stroke-width="${sw}"/>
    <text x="${cx}" y="${ty + tagH / 2 + fontSize * 0.36}" text-anchor="middle" fill="${textFill}" font-family="Arial,sans-serif" font-weight="800" font-size="${fontSize}">${label}</text>
    <line x1="${cx}" y1="${ty + tagH}" x2="${cx}" y2="${ty + tagH + lineH}" stroke="${accent}" stroke-width="${lineW + Math.round(1 * s)}" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${ty + tagH + lineH}" r="${Math.round(3.5 * s)}" fill="${dotOuterFill}"/>
    <circle cx="${cx}" cy="${ty + tagH + lineH}" r="${Math.round(1.5 * s)}" fill="${color}"/>
  </svg>`;

  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(totalW, totalH),
    anchor: new google.maps.Point(cx, ty + tagH + lineH)
  };
}

// ── MARKER MODERNE : étiquette arrondie + trait + point ──
function createClassicMarker(position, label, color, title, targetMap, scale, opts) {
  const isStart = label === 'D';
  return new google.maps.Marker({
    position, map: targetMap || state.map, title,
    icon: _markerSvgIcon(label, color, scale, opts),
    zIndex: isStart ? 1000 : 500
  });
}

// ── NETTOYAGE DES MARKERS ──
function clearMarkers() {
  state.markers.forEach(m => m.setMap(null)); state.markers = [];
  state.previewMarkers.forEach(m => m.setMap(null)); state.previewMarkers = [];
}

// ── ESCAPE SVG (pour texte embarqué dans SVG) ──
function escSvg(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── MARKER ÉLARGI : bulle info SVG (tap = agrandir sur la carte) ──
function _expandedMarkerIcon(delivery, rank) {
  const sec = delivery.sector || 0;
  const fillColor = SECTOR_COLS[sec];
  const textFill  = sec === 0 ? '#1a1a2e' : '#fff';
  const accent    = sec === 0 ? '#1a1a2e' : fillColor;

  const trunc = (s, n) => (s.length > n ? s.substring(0, n - 1) + '…' : s);

  // Lignes d'adresse
  const pn   = delivery.placeName || '';
  const addr = delivery.formatted || delivery.address || '';
  let addrLine1 = '', addrLine2 = '';
  if (pn) {
    addrLine1 = trunc(pn, 28);
    addrLine2 = trunc(addr.replace(/,s*d{5}.*$/, '').trim(), 28);
  } else {
    addrLine1 = trunc(addr, 28);
  }

  // Ligne info : secteur + km/temps
  const secNames = ['Aucun secteur','Secteur 1','Secteur 2','Secteur 3','Secteur 4','Secteur 5'];
  const infoItems = [secNames[sec]];
  if (delivery.legDist && delivery.legDur) infoItems.push(delivery.legDist + ' · ' + delivery.legDur);
  const infoLine = trunc(infoItems.join('   '), 36);
  const noteLine = delivery.note ? trunc(delivery.note, 34) : '';

  const hasLine2 = !!addrLine2;
  const hasNote  = !!noteLine;

  // Dimensions
  const tagW = 228;
  let tagH = 8 + 18 + (hasLine2 ? 14 : 0) + 8 + 14 + (hasNote ? 14 : 0) + 8;
  tagH = Math.ceil(tagH / 2) * 2;

  const lineH = 16, tagR = 8, sw = 2, outerSw = 6;
  const pad   = Math.ceil(outerSw / 2) + 1;
  const totalW = tagW + pad * 2;
  const totalH = tagH + lineH + 4 + pad;
  const cx = totalW / 2, tagX = pad, ty = pad, shOff = 3;

  // Badge circulaire (numéro, côté gauche)
  const bR  = 13;
  const bCx = tagX + 8 + bR;
  const bCy = ty + tagH / 2;
  const nFS = String(rank).length > 2 ? 9 : (String(rank).length > 1 ? 11 : 13);

  // Début du texte (après le badge)
  const tX = tagX + 8 + bR * 2 + 8;

  // Positions Y des lignes de texte
  const y1   = ty + 8 + 13;                        // baseline ligne adresse 1
  const y2   = y1 + 14;                             // baseline ligne adresse 2 (si présente)
  const sepY = (hasLine2 ? y2 : y1) + 8;            // trait séparateur
  const yInf = sepY + 13;                           // baseline info
  const yNot = yInf + 14;                           // baseline note

  const parts = [
    '<svg xmlns="http://www.w3.org/2000/svg"' +
      ' width="' + totalW + '" height="' + totalH + '"' +
      ' viewBox="0 0 ' + totalW + ' ' + totalH + '">',
    // Ombre
    '<rect x="' + (tagX+shOff) + '" y="' + (ty+shOff+1) + '" width="' + tagW + '" height="' + tagH + '" rx="' + tagR + '" fill="rgba(0,0,0,.35)"/>',
    // Contour externe
    '<rect x="' + tagX + '" y="' + ty + '" width="' + tagW + '" height="' + tagH + '" rx="' + tagR + '" fill="none" stroke="' + accent + '" stroke-width="' + outerSw + '"/>',
    // Fond
    '<rect x="' + tagX + '" y="' + ty + '" width="' + tagW + '" height="' + tagH + '" rx="' + tagR + '" fill="' + fillColor + '" stroke="' + textFill + '" stroke-width="' + sw + '" stroke-opacity=".35"/>',
    // Badge cercle
    '<circle cx="' + bCx + '" cy="' + bCy + '" r="' + (bR+2) + '" fill="rgba(0,0,0,.18)"/>',
    '<circle cx="' + bCx + '" cy="' + bCy + '" r="' + bR + '" fill="' + accent + '" opacity=".35"/>',
    // Badge numéro
    '<text x="' + bCx + '" y="' + (bCy + nFS * 0.38) + '" text-anchor="middle"' +
      ' fill="' + textFill + '" font-family="Arial,sans-serif" font-weight="800" font-size="' + nFS + '">' + rank + '</text>',
    // Séparateur vertical badge / texte
    '<line x1="' + (tX-5) + '" y1="' + (ty+6) + '" x2="' + (tX-5) + '" y2="' + (ty+tagH-6) + '"' +
      ' stroke="' + textFill + '" stroke-width="1" stroke-opacity=".15"/>',
    // Adresse ligne 1
    '<text x="' + tX + '" y="' + y1 + '"' +
      ' fill="' + textFill + '" font-family="Arial,sans-serif" font-weight="700" font-size="11">' + escSvg(addrLine1) + '</text>',
  ];

  if (hasLine2) {
    parts.push('<text x="' + tX + '" y="' + y2 + '" fill="' + textFill + '"' +
      ' font-family="Arial,sans-serif" font-size="10" opacity=".85">' + escSvg(addrLine2) + '</text>');
  }

  // Trait horizontal
  parts.push('<line x1="' + (tagX+6) + '" y1="' + sepY + '" x2="' + (tagX+tagW-6) + '" y2="' + sepY + '"' +
    ' stroke="' + textFill + '" stroke-width=".8" stroke-opacity=".2"/>');

  // Info (secteur + km)
  parts.push('<text x="' + tX + '" y="' + yInf + '" fill="' + textFill + '"' +
    ' font-family="Arial,sans-serif" font-size="10" opacity=".8">' + escSvg(infoLine) + '</text>');

  // Note
  if (hasNote) {
    const noteCol = sec === 0 ? '#d97706' : 'rgba(255,220,80,.9)';
    parts.push('<text x="' + tX + '" y="' + yNot + '" fill="' + noteCol + '"' +
      ' font-family="Arial,sans-serif" font-size="9" font-style="italic">' + escSvg(noteLine) + '</text>');
  }

  // Trait d'ancrage + point
  const dotOuter = textFill === '#fff' ? '#fff' : accent;
  parts.push('<line x1="' + cx + '" y1="' + (ty+tagH) + '" x2="' + cx + '" y2="' + (ty+tagH+lineH) + '"' +
    ' stroke="' + accent + '" stroke-width="3" stroke-linecap="round"/>');
  parts.push('<circle cx="' + cx + '" cy="' + (ty+tagH+lineH) + '" r="3.5" fill="' + dotOuter + '"/>');
  parts.push('<circle cx="' + cx + '" cy="' + (ty+tagH+lineH) + '" r="1.5" fill="' + fillColor + '"/>');
  parts.push('</svg>');

  const svg = parts.join('');
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(totalW, totalH),
    anchor: new google.maps.Point(cx, ty + tagH + lineH)
  };
}
