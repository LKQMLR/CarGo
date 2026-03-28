/* ══════════════════════════════════════════
   CarGo — Géocodage & Autocomplete
   Autocomplete Google, adresses fréquentes
   ══════════════════════════════════════════ */

// ── AUTOCOMPLETE ──
function setupAutocomplete(inputId) {
  const input = document.getElementById(inputId);
  const ac = new google.maps.places.Autocomplete(input, {
    componentRestrictions: { country: 'fr' },
    fields: ['formatted_address', 'geometry', 'name', 'types']
  });
  input._autocomplete = ac;
  ac.addListener('place_changed', () => {
    const p = ac.getPlace();
    if (p.geometry) {
      input.dataset.lat = p.geometry.location.lat();
      input.dataset.lng = p.geometry.location.lng();
      // Détection nom d'entreprise via le type "establishment"
      const isEstablishment = p.types && p.types.some(t =>
        ['establishment', 'point_of_interest', 'store', 'food', 'restaurant', 'cafe', 'shopping_mall', 'supermarket', 'locality'].includes(t)
      );
      const nameIsAddr = !p.name || p.formatted_address.toLowerCase().includes(p.name.toLowerCase());
      input.dataset.placeName = (isEstablishment && !nameIsAddr) ? p.name : '';
      input.dataset.formatted = p.formatted_address;
      input.dataset.resolved = 'true';
    }
    // Forcer la fermeture du dropdown après sélection (délai pour laisser Google finir)
    setTimeout(() => {
      document.querySelectorAll('.pac-container').forEach(el => {
        el.style.display = 'none';
      });
    }, 300);
  });
  input.addEventListener('input', () => { input.dataset.resolved = ''; });
  if (inputId === 'start-input') {
    ac.addListener('place_changed', () => { setTimeout(() => updateFavStar(), 50); });
  }
}

// ── BIAIS AUTOCOMPLETE (~30km autour du départ) ──
function updateAutocompleteBias() {
  if (!state.startPoint) return;
  const center = { lat: state.startPoint.lat, lng: state.startPoint.lng };
  const offset = 0.27; // ~30km
  const b = new google.maps.LatLngBounds(
    { lat: center.lat - offset, lng: center.lng - offset },
    { lat: center.lat + offset, lng: center.lng + offset }
  );
  const el = document.getElementById('delivery-input');
  if (el._autocomplete) { el._autocomplete.setBounds(b); el._autocomplete.setOptions({ strictBounds: true }); }
}

// ── GÉOCODAGE ──
function geocodeAddress(address) {
  return new Promise((resolve, reject) => {
    state.geocoder.geocode({ address, region: 'fr' }, (r, s) => {
      if (s === 'OK' && r.length) {
        resolve({ lat: r[0].geometry.location.lat(), lng: r[0].geometry.location.lng(), formatted: r[0].formatted_address });
      } else {
        reject(new Error(`Adresse introuvable : "${address}"`));
      }
    });
  });
}

async function resolveInput(el) {
  if (el.dataset.resolved === 'true') {
    return { lat: parseFloat(el.dataset.lat), lng: parseFloat(el.dataset.lng), formatted: el.dataset.formatted, placeName: el.dataset.placeName || '' };
  }
  return geocodeAddress(el.value.trim());
}

// ── FAVORIS ──
function getFavorites() {
  try { return JSON.parse(localStorage.getItem('cargo_favorites') || '[]'); }
  catch { return []; }
}
function saveFavorites(list) {
  localStorage.setItem('cargo_favorites', JSON.stringify(list));
}
function isFavorite(formatted) {
  return getFavorites().some(f => f.formatted === formatted);
}
function toggleFavorite() {
  const input = document.getElementById('start-input');
  const btn = document.getElementById('fav-star-btn');
  const formatted = input.dataset.formatted || input.value.trim();
  if (!formatted) return;
  const favs = getFavorites();
  const idx = favs.findIndex(f => f.formatted === formatted);
  if (idx !== -1) {
    favs.splice(idx, 1);
    btn.innerHTML = '&#9734;'; btn.classList.remove('active');
  } else {
    const addr = {
      address: input.value.trim(),
      formatted: input.dataset.formatted || input.value.trim(),
      lat: parseFloat(input.dataset.lat) || null,
      lng: parseFloat(input.dataset.lng) || null,
      placeName: input.dataset.placeName || ''
    };
    // Compléter depuis les fréquentes si manque lat/lng
    if (!addr.lat) {
      const freq = getFrequentAddresses().find(a => a.formatted === addr.formatted);
      if (freq) { addr.lat = freq.lat; addr.lng = freq.lng; addr.placeName = freq.placeName || ''; }
    }
    if (!addr.lat) return; // pas de coordonnées, ne pas sauver
    favs.unshift(addr);
    btn.innerHTML = '&#9733;'; btn.classList.add('active');
  }
  saveFavorites(favs);
}
function updateFavStar() {
  const input = document.getElementById('start-input');
  const btn = document.getElementById('fav-star-btn');
  const formatted = input.dataset.formatted || input.value.trim();
  if (formatted && isFavorite(formatted)) {
    btn.innerHTML = '&#9733;'; btn.classList.add('active');
  } else {
    btn.innerHTML = '&#9734;'; btn.classList.remove('active');
  }
}

// ── ADRESSES FRÉQUENTES ──
function getFrequentAddresses() {
  try { return JSON.parse(localStorage.getItem('cargo_freqAddr') || '[]'); }
  catch { return []; }
}

function saveFrequentAddress(addr) {
  const list = getFrequentAddresses();
  const ex = list.find(a => a.formatted === addr.formatted);
  if (ex) { ex.count++; ex.lastUsed = Date.now(); }
  else { list.push({ ...addr, count: 1, lastUsed: Date.now() }); }
  list.sort((a, b) => b.count - a.count);
  localStorage.setItem('cargo_freqAddr', JSON.stringify(list.slice(0, 50)));
}

function showFreqDropdown(inputId, dropdownId) {
  const input = document.getElementById(inputId), dd = document.getElementById(dropdownId);
  const q = input.value.trim().toLowerCase();
  const all = getFrequentAddresses();
  const favs = getFavorites();
  const favFormatted = new Set(favs.map(f => f.formatted));

  const filterFn = a => q.length === 0 || a.formatted.toLowerCase().includes(q) || a.address.toLowerCase().includes(q) || (a.placeName && a.placeName.toLowerCase().includes(q));

  const favMatches = favs.filter(filterFn).slice(0, 5);
  const recentMatches = all.filter(a => !favFormatted.has(a.formatted) && filterFn(a)).slice(0, 5);

  if (!favMatches.length && !recentMatches.length) { dd.classList.remove('visible'); return; }

  const escFn = s => { const d = document.createElement('div'); d.appendChild(document.createTextNode(s || '')); return d.innerHTML; };
  const renderItem = (a, isFav) => {
    const fmtShort = a.formatted.length > 50 ? a.formatted.substring(0,47)+'...' : a.formatted;
    return `<div class="freq-item ${isFav ? 'is-fav' : 'is-recent'}" data-lat="${a.lat}" data-lng="${a.lng}" data-formatted="${escFn(a.formatted)}" data-address="${escFn(a.address)}" data-note="${escFn(a.note||'')}" data-place-name="${escFn(a.placeName||'')}">
      <span class="freq-icon">${isFav ? '&#9733;' : '&#9734;'}</span><span>${a.placeName ? '<b>'+escFn(a.placeName)+'</b> · ' : ''}${escFn(fmtShort)}${a.note ? ' <small style="color:var(--yellow)">'+escFn(a.note)+'</small>' : ''}</span>
    </div>`;
  };

  let html = '';
  if (favMatches.length) {
    html += '<div class="freq-fav-sep">Favoris</div>';
    html += favMatches.map(a => renderItem(a, true)).join('');
  }
  if (recentMatches.length) {
    if (favMatches.length) html += '<div class="freq-fav-sep" style="color:var(--text2)">Récents</div>';
    html += recentMatches.map(a => renderItem(a, false)).join('');
  }

  dd.innerHTML = html;
  dd.classList.add('visible');
  dd.querySelectorAll('.freq-item').forEach(item => {
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      input.value = item.dataset.address;
      input.dataset.lat = item.dataset.lat; input.dataset.lng = item.dataset.lng;
      input.dataset.formatted = item.dataset.formatted;
      input.dataset.placeName = item.dataset.placeName || '';
      input.dataset.resolved = 'true';
      dd.classList.remove('visible');
      if (inputId === 'start-input') updateFavStar();
    });
  });
}

function setupFreqDropdown(inputId, dropdownId) {
  const input = document.getElementById(inputId);
  input.addEventListener('focus', () => showFreqDropdown(inputId, dropdownId));
  input.addEventListener('input', () => { showFreqDropdown(inputId, dropdownId); if (inputId === 'start-input') updateFavStar(); });
  input.addEventListener('blur', () => { setTimeout(() => document.getElementById(dropdownId).classList.remove('visible'), 150); });
}

function saveNoteToFrequent(formatted, note) {
  const list = getFrequentAddresses();
  const ex = list.find(a => a.formatted === formatted);
  if (ex) { ex.note = note; localStorage.setItem('cargo_freqAddr', JSON.stringify(list)); }
}
