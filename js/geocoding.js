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
  });
  input.addEventListener('input', () => { input.dataset.resolved = ''; });
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
  const q = input.value.trim().toLowerCase(), all = getFrequentAddresses();
  if (!all.length) { dd.classList.remove('visible'); return; }
  const matches = q.length === 0
    ? all.slice(0, 8)
    : all.filter(a => a.formatted.toLowerCase().includes(q) || a.address.toLowerCase().includes(q) || (a.placeName && a.placeName.toLowerCase().includes(q))).slice(0, 8);
  if (!matches.length) { dd.classList.remove('visible'); return; }
  dd.innerHTML = matches.map(a => {
    const esc = s => { const d = document.createElement('div'); d.appendChild(document.createTextNode(s || '')); return d.innerHTML; };
    const fmtShort = a.formatted.length > 50 ? a.formatted.substring(0,47)+'...' : a.formatted;
    return `<div class="freq-item" data-lat="${a.lat}" data-lng="${a.lng}" data-formatted="${esc(a.formatted)}" data-address="${esc(a.address)}" data-note="${esc(a.note||'')}" data-place-name="${esc(a.placeName||'')}">
      <span class="freq-icon">&#9733;</span><span>${a.placeName ? '<b>'+esc(a.placeName)+'</b> · ' : ''}${esc(fmtShort)}${a.note ? ' <small style="color:var(--yellow)">'+esc(a.note)+'</small>' : ''}</span>
    </div>`;
  }).join('');
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
    });
  });
}

function setupFreqDropdown(inputId, dropdownId) {
  const input = document.getElementById(inputId);
  input.addEventListener('focus', () => showFreqDropdown(inputId, dropdownId));
  input.addEventListener('input', () => showFreqDropdown(inputId, dropdownId));
  input.addEventListener('blur', () => { setTimeout(() => document.getElementById(dropdownId).classList.remove('visible'), 150); });
}

function saveNoteToFrequent(formatted, note) {
  const list = getFrequentAddresses();
  const ex = list.find(a => a.formatted === formatted);
  if (ex) { ex.note = note; localStorage.setItem('cargo_freqAddr', JSON.stringify(list)); }
}
