/* ══════════════════════════════════════════
   CarGo — Géocodage & Autocomplete
   Autocomplete Google, adresses fréquentes
   ══════════════════════════════════════════ */

// ── AUTOCOMPLETE ──
function setupAutocomplete(inputId) {
  const input = document.getElementById(inputId);
  const ac = new google.maps.places.Autocomplete(input, {
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
  if (inputId === 'delivery-overlay-input') {
    ac.addListener('place_changed', () => {
      const overlayInput = document.getElementById('delivery-overlay-input');
      if (!overlayInput.dataset.resolved) return;
      _syncOverlayToMain(overlayInput);
      closeDeliveryOverlay();
      setTimeout(() => handleAddDelivery(), 80);
    });
  }
}

// ── BIAIS AUTOCOMPLETE (bounds dynamiques autour du point de départ) ──
function updateAutocompleteBias() {
  if (!state.startPoint) return;
  const lat = state.startPoint.lat, lng = state.startPoint.lng;
  const delta = 0.09; // ~10 km
  const bounds = new google.maps.LatLngBounds(
    { lat: lat - delta, lng: lng - delta },
    { lat: lat + delta, lng: lng + delta }
  );
  ['start-input', 'delivery-input', 'delivery-overlay-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el._autocomplete) {
      el._autocomplete.setBounds(bounds);
    }
  });
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
const _starOff = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>';
const _starOn = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffec1a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>';

function toggleFavorite() {
  const input = document.getElementById('start-input');
  const btn = document.getElementById('fav-star-btn');
  const formatted = input.dataset.formatted || input.value.trim();
  if (!formatted) return;
  const favs = getFavorites();
  const idx = favs.findIndex(f => f.formatted === formatted);
  if (idx !== -1) {
    favs.splice(idx, 1);
    btn.innerHTML = _starOff; btn.classList.remove('active');
  } else {
    const addr = {
      address: input.value.trim(),
      formatted: input.dataset.formatted || input.value.trim(),
      lat: parseFloat(input.dataset.lat) || null,
      lng: parseFloat(input.dataset.lng) || null,
      placeName: input.dataset.placeName || ''
    };
    if (!addr.lat) {
      const freq = getFrequentAddresses().find(a => a.formatted === addr.formatted);
      if (freq) { addr.lat = freq.lat; addr.lng = freq.lng; addr.placeName = freq.placeName || ''; }
    }
    if (!addr.lat) return;
    favs.unshift(addr);
    btn.innerHTML = _starOn; btn.classList.add('active');
  }
  saveFavorites(favs);
}
function updateFavStar() {
  const input = document.getElementById('start-input');
  const btn = document.getElementById('fav-star-btn');
  const formatted = input.dataset.formatted || input.value.trim();
  if (formatted && isFavorite(formatted)) {
    btn.innerHTML = _starOn; btn.classList.add('active');
  } else {
    btn.innerHTML = _starOff; btn.classList.remove('active');
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
      if (inputId === 'delivery-input') _updateDeliveryClear();
      if (inputId === 'delivery-overlay-input') {
        _syncOverlayToMain(input);
        closeDeliveryOverlay();
        setTimeout(() => handleAddDelivery(), 80);
      }
    });
  });
}

function setupFreqDropdown(inputId, dropdownId) {
  const input = document.getElementById(inputId);
  input.addEventListener('focus', () => showFreqDropdown(inputId, dropdownId));
  input.addEventListener('input', () => {
    showFreqDropdown(inputId, dropdownId);
    if (inputId === 'start-input') updateFavStar();
    if (inputId === 'delivery-input') _updateDeliveryClear();
    if (inputId === 'delivery-overlay-input') _updateOverlayClear();
  });
  input.addEventListener('blur', () => { setTimeout(() => document.getElementById(dropdownId).classList.remove('visible'), 150); });
}

function _updateDeliveryClear() {
  const btn = document.getElementById('delivery-clear');
  const input = document.getElementById('delivery-input');
  if (btn) btn.style.display = input.value.trim() ? 'flex' : 'none';
}

function clearDeliveryInput() {
  const input = document.getElementById('delivery-input');
  input.value = '';
  input.dataset.lat = ''; input.dataset.lng = '';
  input.dataset.formatted = ''; input.dataset.resolved = '';
  _updateDeliveryClear();
  input.focus();
}

function saveNoteToFrequent(formatted, note) {
  const list = getFrequentAddresses();
  const ex = list.find(a => a.formatted === formatted);
  if (ex) { ex.note = note; localStorage.setItem('cargo_freqAddr', JSON.stringify(list)); }
}

// ── OVERLAY SAISIE ADRESSE ──
function _syncOverlayToMain(overlayInput) {
  const main = document.getElementById('delivery-input');
  main.value = overlayInput.value;
  main.dataset.lat = overlayInput.dataset.lat || '';
  main.dataset.lng = overlayInput.dataset.lng || '';
  main.dataset.formatted = overlayInput.dataset.formatted || '';
  main.dataset.placeName = overlayInput.dataset.placeName || '';
  main.dataset.resolved = overlayInput.dataset.resolved || '';
}

function openDeliveryOverlay() {
  const overlay = document.getElementById('delivery-overlay');
  const input = document.getElementById('delivery-overlay-input');
  overlay.classList.add('visible');
  document.body.classList.add('overlay-open');
  if (state.startPoint) updateAutocompleteBias();
  input.focus();
}

function closeDeliveryOverlay() {
  const overlay = document.getElementById('delivery-overlay');
  overlay.classList.remove('visible');
  document.body.classList.remove('overlay-open');
  const input = document.getElementById('delivery-overlay-input');
  input.value = '';
  input.dataset.lat = ''; input.dataset.lng = '';
  input.dataset.formatted = ''; input.dataset.resolved = ''; input.dataset.placeName = '';
  document.getElementById('delivery-overlay-clear').style.display = 'none';
}

function clearDeliveryOverlayInput() {
  const input = document.getElementById('delivery-overlay-input');
  input.value = '';
  input.dataset.lat = ''; input.dataset.lng = '';
  input.dataset.formatted = ''; input.dataset.resolved = '';
  _updateOverlayClear();
  showFreqDropdown('delivery-overlay-input', 'freq-delivery-overlay');
  input.focus();
}

function _updateOverlayClear() {
  const btn = document.getElementById('delivery-overlay-clear');
  const input = document.getElementById('delivery-overlay-input');
  if (btn) btn.style.display = input.value.trim() ? 'flex' : 'none';
}

function submitDeliveryOverlay() {
  const input = document.getElementById('delivery-overlay-input');
  if (!input.value.trim()) return;
  _syncOverlayToMain(input);
  closeDeliveryOverlay();
  setTimeout(() => handleAddDelivery(), 80);
}
