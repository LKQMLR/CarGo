/* ══════════════════════════════════════════
   CarGo — Gestion des livraisons
   Ajout, suppression, notes, lock, secteurs,
   drag & drop, swipe-to-delete
   ══════════════════════════════════════════ */

// ── ÉCHAPPEMENT HTML (anti-XSS) ──
function esc(s) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(s || ''));
  return d.innerHTML;
}

// ── SECTEUR ACTIF ──
let activeSector = 0;
const SECTOR_LABELS = ['Aucun secteur', 'Secteur 1', 'Secteur 2', 'Secteur 3', 'Secteur 4', 'Secteur 5'];

let _sectorLocked = false;
function cycleSector() {
  if (_sectorLocked) return;
  _sectorLocked = true;
  setTimeout(() => { _sectorLocked = false; }, 300);

  let next = (activeSector + 1) % 6;
  // En gratuit : secteurs 0, 1, 2 uniquement
  if (next > 0 && !checkSectorLimit(next)) {
    next = 0; // revenir à "Aucun secteur"
  }
  activeSector = next;
  const btn = document.getElementById('btn-sector');
  btn.textContent = SECTOR_LABELS[activeSector];
  btn.className = activeSector ? `s${activeSector}` : '';
}

// ── HANDLERS DE SAISIE ──
async function handleSetStart() {
  const input = document.getElementById('start-input'), addr = input.value.trim();
  if (!addr) return;
  setUIBusy(true); showStatus('loading', 'Géocodage...');
  try {
    const geo = await resolveInput(input);
    if (state.startPoint?.marker) state.startPoint.marker.setMap(null);
    const marker = createClassicMarker({ lat: geo.lat, lng: geo.lng }, 'D', '#22c55e', 'Départ');
    state.startPoint = { address: addr, ...geo, marker };
    state.map.panTo({ lat: geo.lat, lng: geo.lng }); state.map.setZoom(14);
    const d = document.getElementById('start-display');
    d.textContent = geo.formatted; d.classList.add('visible');
    saveFrequentAddress({ address: addr, lat: geo.lat, lng: geo.lng, formatted: geo.formatted });
    updateAutocompleteBias(); showStatus('success', 'Départ défini.'); saveSession();
    updateFavStar();
    localStorage.setItem('cargo_startPoint', JSON.stringify({ address: addr, lat: geo.lat, lng: geo.lng, formatted: geo.formatted }));
  } catch (e) { showStatus('error', e.message); }
  finally { setUIBusy(false); }
}

async function handleAddDelivery() {
  const input = document.getElementById('delivery-input'), addr = input.value.trim();
  if (!addr) return;
  if (!checkAddressLimit()) return;
  setUIBusy(true); showStatus('loading', 'Géocodage...');
  try {
    const geo = await resolveInput(input);
    // Détection de doublon par adresse formatée
    const duplicate = state.deliveries.find(d => d.formatted === geo.formatted);
    if (duplicate) {
      setUIBusy(false);
      const confirmed = await showConfirm(`Cette adresse est déjà dans la liste :<strong>${esc(duplicate.formatted)}</strong>`);
      if (!confirmed) return;
      setUIBusy(true);
    }
    const marker = createClassicMarker({ lat: geo.lat, lng: geo.lng }, String(state.deliveries.length + 1), '#ef4444', geo.formatted);
    const freq = getFrequentAddresses().find(a => a.formatted === geo.formatted) || {};
    const freqNote = freq.note || '';
    const placeName = geo.placeName || freq.placeName || '';
    state.deliveries.push({ id: idCounter++, address: addr, ...geo, placeName, marker, note: freqNote, sector: activeSector });
    state.map.panTo({ lat: geo.lat, lng: geo.lng }); state.map.setZoom(14);
    renderDeliveryList();
    saveFrequentAddress({ address: addr, lat: geo.lat, lng: geo.lng, formatted: geo.formatted, placeName });
    updateAutocompleteBias();
    input.value = ''; input.dataset.resolved = ''; input.dataset.placeName = '';
    showStatus('success', `${state.deliveries.length} adresse(s) ajoutée(s).`);
    saveSession();
    // Scroll vers la dernière adresse ajoutée
    const ul = document.getElementById('delivery-list');
    ul.scrollTop = ul.scrollHeight;
  } catch (e) { showStatus('error', e.message); }
  finally { setUIBusy(false); }
}

// ── SUPPRESSION ──
function removeDelivery(id) {
  const idx = state.deliveries.findIndex(d => d.id === id);
  if (idx === -1) return;
  if (state.deliveries[idx].marker) state.deliveries[idx].marker.setMap(null);
  state.deliveries.splice(idx, 1);
  clearMarkers();
  state.directionsRenderer.setDirections({ routes: [] });
  if (state.previewRenderer) state.previewRenderer.setDirections({ routes: [] });
  state.navStops = null; state.navLegs = null;
  state.deliveries.forEach(d => { d.legDist = ''; d.legDur = ''; });
  document.getElementById('results-panel').classList.remove('visible');
  document.getElementById('btn-nav-start').classList.remove('visible');
  renderDeliveryList();
  saveSession();
}

// ── NOTES ──
function saveNote(id, note) {
  const d = state.deliveries.find(d => d.id === id);
  if (d) { d.note = note.trim(); saveNoteToFrequent(d.formatted, d.note); saveSession(); renderDeliveryList(); }
}

function editNote(id) {
  const d = state.deliveries.find(d => d.id === id); if (!d) return;
  const li = document.querySelector(`[data-id="${id}"]`);
  const noteEl = li.querySelector('.delivery-note');
  const input = li.querySelector('.delivery-note-input');
  if (noteEl) noteEl.style.display = 'none';
  input.style.display = ''; input.value = d.note; input.focus();
}

// ── CADENAS (lock/unlock) ──
function toggleLock(id) {
  const d = state.deliveries.find(d => d.id === id); if (!d) return;
  // Si on veut verrouiller (pas déverrouiller), vérifier la limite
  if (!d.locked && !checkLockLimit()) return;
  d.locked = !d.locked;
  // Mise à jour in-place sans re-render complet
  const li = document.querySelector(`[data-id="${id}"]`);
  if (li) {
    li.classList.toggle('delivery-locked', d.locked);
    const badge = li.querySelector('.lock-badge');
    if (badge) {
      badge.className = d.locked ? 'lock-badge locked' : 'lock-badge unlocked';
      badge.innerHTML = d.locked
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';
    }
  }
  saveSession();
}

// ── RENDU DE LA LISTE ──
function renderDeliveryList() {
  const ul = document.getElementById('delivery-list');
  const countEl = document.getElementById('delivery-count');
  countEl.textContent = state.deliveries.length ? `(${state.deliveries.length})` : '';
  if (!state.deliveries.length) { ul.innerHTML = ''; return; }
  ul.innerHTML = state.deliveries.map((d, i) => {
    const rawAddr = d.formatted.length > 50 ? d.formatted.substring(0, 47) + '...' : d.formatted;
    const addr = esc(rawAddr);
    const placeLabel = d.placeName ? `<div class="delivery-place-name">${esc(d.placeName)}</div>` : '';
    const noteDisplay = d.note ? `<div class="delivery-note" onclick="editNote(${d.id})" title="Cliquer pour modifier">${esc(d.note)}</div>` : '';
    const inputStyle = d.note ? 'display:none' : '';
    const legInfo = d.legDist && d.legDur ? `<div class="delivery-leg-info"><span>${d.legDist}</span><span>·</span><span>${d.legDur}</span></div>` : '';
    const badgeClass = d.locked ? 'lock-badge locked' : 'lock-badge unlocked';
    const lockSvg = d.locked
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';
    const sec = d.sector || 0;
    const liClasses = [d.locked ? 'delivery-locked' : '', sec && !d.locked ? `sector-${sec}` : ''].filter(Boolean).join(' ');
    return `<li data-idx="${i}" data-id="${d.id}" class="${liClasses}">
      <div class="delivery-content">
        <div class="drag-handle">&#8942;&#8942;</div>
        <div class="delivery-num${d.customOrder ? ' custom' : ''}${sec ? ` sec-${sec}` : ''}">${i + 1}</div>
        <div class="delivery-addr">${placeLabel}${addr}${noteDisplay}
          <input class="delivery-note-input" style="${inputStyle}" placeholder="Note (code, étage...)" value="" maxlength="44"
            onblur="saveNote(${d.id}, this.value)" data-id="${d.id}" />${legInfo}
        </div>
        <div class="${badgeClass}" onclick="toggleLock(${d.id})">${lockSvg}</div>
      </div>
      <button class="delivery-delete" onclick="removeDelivery(${d.id})">Supprimer</button>
    </li>`;
  }).join('');
  initDragAndDrop();
  initTouchGestures();
  initDoubleTapSector();
}

// ── DÉPLACEMENT (drag result) ──
function moveToPosition(from, to) {
  if (from === to) return;
  state.deliveries.splice(to, 0, state.deliveries.splice(from, 1)[0]);
  state.deliveries[to].customOrder = true;
  renderDeliveryList();
  if (state.startPoint && state.deliveries.length) displayRoute([state.startPoint, ...state.deliveries]);
  saveSession();
}

// ── DRAG & DROP ──
function initDragAndDrop() {
  const ul = document.getElementById('delivery-list');
  const items = ul.querySelectorAll('li');
  items.forEach(li => {
    const handle = li.querySelector('.drag-handle');
    let ghost = null;

    function createGhost(li, x, y) {
      ghost = document.createElement('div'); ghost.className = 'drag-ghost';
      const num = li.querySelector('.delivery-num');
      const addr = li.querySelector('.delivery-addr');
      ghost.innerHTML = `<div class="${num.className}">${num.textContent}</div><div class="delivery-addr">${addr.innerHTML}</div>`;
      document.body.appendChild(ghost); moveGhost(x, y);
    }
    function moveGhost(x, y) { if (ghost) { ghost.style.left = '20px'; ghost.style.top = (y - 24) + 'px'; } }
    function removeGhost() { if (ghost) { ghost.remove(); ghost = null; } }

    let scrollInterval = null;
    function autoScroll(y) {
      const rect = ul.getBoundingClientRect();
      const zone = 40;
      clearInterval(scrollInterval);
      if (y < rect.top + zone && ul.scrollTop > 0) {
        scrollInterval = setInterval(() => { ul.scrollTop -= 6; }, 16);
      } else if (y > rect.bottom - zone && ul.scrollTop < ul.scrollHeight - ul.clientHeight) {
        scrollInterval = setInterval(() => { ul.scrollTop += 6; }, 16);
      }
    }
    function stopAutoScroll() { clearInterval(scrollInterval); scrollInterval = null; }

    function clearHighlights() { items.forEach(el => { el.classList.remove('drag-neighbor-above', 'drag-neighbor-below'); void el.offsetWidth; }); }
    let _lastHighlight = null;
    function highlightGap(y) {
      clearHighlights();
      const gap = getInsertGap(ul, y, li);
      const key = (gap.above?.dataset.idx || '') + '-' + (gap.below?.dataset.idx || '');
      const changed = key !== _lastHighlight;
      if (gap.above) {
        if (changed) gap.above.style.setProperty('--pulse-dir', '-4px');
        gap.above.classList.add('drag-neighbor-above');
      }
      if (gap.below) {
        if (changed) gap.below.style.setProperty('--pulse-dir', '4px');
        gap.below.classList.add('drag-neighbor-below');
      }
      if (changed) {
        _lastHighlight = key;
        if (navigator.vibrate) navigator.vibrate(15);
      }
    }

    // SOURIS
    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      const dragIdx = parseInt(li.dataset.idx);
      li.classList.add('dragging'); createGhost(li, e.clientX, e.clientY);
      const onMove = e2 => { moveGhost(e2.clientX, e2.clientY); highlightGap(e2.clientY); autoScroll(e2.clientY); };
      const onUp = e2 => {
        document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
        stopAutoScroll(); li.classList.remove('dragging'); clearHighlights(); removeGhost();
        const gap = getInsertGap(ul, e2.clientY, li);
        if (gap.insertIdx !== dragIdx && gap.insertIdx !== dragIdx + 1) {
          const to = gap.insertIdx > dragIdx ? gap.insertIdx - 1 : gap.insertIdx;
          moveToPosition(dragIdx, to);
        }
      };
      document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    });

    // TACTILE
    handle.addEventListener('touchstart', e => {
      e.preventDefault(); _dragActive = true;
      li._dragIdx = parseInt(li.dataset.idx); li.classList.add('dragging');
      const touch = e.touches[0]; createGhost(li, touch.clientX, touch.clientY);
    }, { passive: false });
    handle.addEventListener('touchmove', e => {
      e.preventDefault(); const touch = e.touches[0]; moveGhost(touch.clientX, touch.clientY);
      highlightGap(touch.clientY); autoScroll(touch.clientY);
    }, { passive: false });
    handle.addEventListener('touchend', e => {
      _dragActive = false;
      const dragIdx = li._dragIdx;
      stopAutoScroll(); li.classList.remove('dragging'); clearHighlights(); removeGhost();
      const touch = e.changedTouches[0];
      const gap = getInsertGap(ul, touch.clientY, li);
      if (gap.insertIdx !== dragIdx && gap.insertIdx !== dragIdx + 1) {
        const to = gap.insertIdx > dragIdx ? gap.insertIdx - 1 : gap.insertIdx;
        moveToPosition(dragIdx, to);
      }
    });
  });
}

function getInsertGap(ul, y, dragLi) {
  const items = [...ul.querySelectorAll('li')].filter(el => el !== dragLi);
  if (!items.length) return { above: null, below: null, insertIdx: 0 };
  for (let i = 0; i < items.length; i++) {
    const r = items[i].getBoundingClientRect();
    if (y < r.top + r.height / 2) {
      return { above: i > 0 ? items[i - 1] : null, below: items[i], insertIdx: parseInt(items[i].dataset.idx) };
    }
  }
  const last = items[items.length - 1];
  return { above: last, below: null, insertIdx: parseInt(last.dataset.idx) + 1 };
}

// ── SWIPE TO DELETE ──
let _dragActive = false;

function initTouchGestures() {
  const BTN_W = 110;
  const items = document.querySelectorAll('#delivery-list li');
  items.forEach(li => {
    let startX = 0, startY = 0, swiping = false, locked = false, revealed = false;
    const btn = li.querySelector('.delivery-delete');
    const content = li.querySelector('.delivery-content');

    li.addEventListener('touchstart', e => {
      if (_dragActive) return;
      if (e.target.closest('.drag-handle') || e.target.closest('.delivery-note-input') || e.target.closest('.lock-badge') || e.target.closest('.delivery-delete')) return;
      // Si déjà révélé, un tap sur le contenu referme
      if (li.classList.contains('swipe-reveal')) {
        li.classList.remove('swipe-reveal');
        btn.style.transform = ''; content.style.filter = ''; content.style.opacity = '';
        locked = true; return;
      }
      startX = e.touches[0].clientX; startY = e.touches[0].clientY;
      swiping = false; locked = false;
      btn.style.transition = 'none';
      content.style.transition = 'none';
    }, { passive: true });

    li.addEventListener('touchmove', e => {
      if (_dragActive || locked) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!swiping && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { locked = true; return; }
      if (!swiping && Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy) * 1.5) swiping = true;
      if (!swiping) return;
      e.preventDefault();
      const offset = Math.max(0, Math.min(BTN_W, -dx));
      const pct = offset / BTN_W;
      btn.style.transform = `translateX(${100 - pct * 100}%)`;
      content.style.filter = `blur(${pct * 3}px)`;
      content.style.opacity = String(1 - pct * 0.5);
    }, { passive: false });

    li.addEventListener('touchend', e => {
      btn.style.transition = '';
      content.style.transition = '';
      if (!swiping) return;
      const dx = e.changedTouches[0].clientX - startX;
      const offset = Math.max(0, Math.min(BTN_W, -dx));
      if (offset > BTN_W * 0.4) {
        li.classList.add('swipe-reveal');
        btn.style.transform = ''; content.style.filter = ''; content.style.opacity = '';
        const closeSwipe = (ev) => {
          if (ev.target.closest('.delivery-delete')) return;
          li.classList.remove('swipe-reveal');
          btn.style.transform = ''; content.style.filter = ''; content.style.opacity = '';
          document.removeEventListener('touchstart', closeSwipe);
        };
        setTimeout(() => document.addEventListener('touchstart', closeSwipe), 100);
      } else {
        li.classList.remove('swipe-reveal');
        btn.style.transform = ''; content.style.filter = ''; content.style.opacity = '';
      }
      swiping = false;
    });
  });
}

// ── DOUBLE-TAP CHANGEMENT DE SECTEUR (Premium) ──
function initDoubleTapSector() {
  const items = document.querySelectorAll('#delivery-list li');
  items.forEach(li => {
    let lastTap = 0;
    let usedTouch = false;
    li.addEventListener('touchend', e => {
      if (e.target.closest('.drag-handle') || e.target.closest('.lock-badge') || e.target.closest('.delivery-delete') || e.target.closest('.delivery-note-input') || e.target.closest('.delivery-note')) return;
      usedTouch = true;
      const now = Date.now();
      if (now - lastTap < 350) {
        e.preventDefault();
        const id = parseInt(li.dataset.id);
        cycleSectorForDelivery(id, li);
        lastTap = 0;
      } else {
        lastTap = now;
      }
    });
    // Desktop uniquement (pas si touch déjà utilisé)
    li.addEventListener('dblclick', e => {
      if (usedTouch) return;
      if (e.target.closest('.drag-handle') || e.target.closest('.lock-badge') || e.target.closest('.delivery-delete') || e.target.closest('.delivery-note-input') || e.target.closest('.delivery-note')) return;
      const id = parseInt(li.dataset.id);
      cycleSectorForDelivery(id, li);
    });
  });
}

function cycleSectorForDelivery(id, li) {
  if (!isPremium()) {
    showLimitAlert('secteur', 'Changement de secteur à la volée réservé aux Premium.');
    return;
  }
  const d = state.deliveries.find(d => d.id === id);
  if (!d) return;

  // Cycle : secteur actuel → +1, revient à 0 après 5
  const oldSec = d.sector || 0;
  d.sector = (oldSec + 1) % 6;
  const sec = d.sector;

  // Mise à jour visuelle in-place — bordure gauche
  li.classList.remove('sector-1', 'sector-2', 'sector-3', 'sector-4', 'sector-5');
  if (sec && !d.locked) li.classList.add(`sector-${sec}`);

  // Mise à jour visuelle — pastille numéro
  const numEl = li.querySelector('.delivery-num');
  if (numEl) {
    numEl.classList.remove('sec-1', 'sec-2', 'sec-3', 'sec-4', 'sec-5');
    if (sec) numEl.classList.add(`sec-${sec}`);
    // Animation flash pour feedback
    numEl.style.transition = 'transform .15s ease';
    numEl.style.transform = 'scale(1.3)';
    setTimeout(() => { numEl.style.transform = ''; }, 150);
  }

  saveSession();
}


// ── CYCLE SECTEUR DEPUIS LA CARTE (tap double sur marker) ──
function cycleSectorFromMap(id) {
  if (!isPremium()) {
    showLimitAlert('secteur', 'Changement de secteur à la volée réservé aux Premium.');
    return;
  }
  const d = state.deliveries.find(d => d.id === id);
  if (!d) return;
  d.sector = ((d.sector || 0) + 1) % 6;
  saveSession();
  renderDeliveryList();
  if (state.startPoint && state.deliveries.length > 1) optimizeRoute();
  else if (state.startPoint && state.deliveries.length) displayRoute([state.startPoint, ...state.deliveries]);
}
