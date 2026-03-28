/* ══════════════════════════════════════════
   CarGo — Historique des tournées & Export
   ══════════════════════════════════════════ */

const HISTORY_KEY = 'cargo_history';
const HISTORY_MAX = 20;

// ── LECTURE / ÉCRITURE ──
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

// ── SAUVEGARDER LA TOURNÉE COURANTE ──
function saveToHistory() {
  const name = document.getElementById('save-history-name').value.trim()
    || `Tournée du ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
  if (!state.deliveries.length) return;
  const history = getHistory();
  const entry = {
    id: Date.now(),
    name,
    date: Date.now(),
    startPoint: state.startPoint
      ? { address: state.startPoint.address, lat: state.startPoint.lat, lng: state.startPoint.lng, formatted: state.startPoint.formatted }
      : null,
    deliveries: state.deliveries.map(d => ({
      address: d.address, lat: d.lat, lng: d.lng, formatted: d.formatted,
      placeName: d.placeName || '', note: d.note || '',
      sector: d.sector || 0, locked: d.locked || false, customOrder: d.customOrder || false
    })),
    count: state.deliveries.length,
  };
  history.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_MAX)));
  closeSaveHistoryModal();
  showStatus('success', `"${name}" sauvegardée !`);
}

// ── MODALE SAUVEGARDER ──
function promptSaveHistory() {
  const modal = document.getElementById('save-history-modal');
  const input = document.getElementById('save-history-name');
  input.value = `Tournée du ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
  modal.classList.add('visible');
  setTimeout(() => { input.select(); }, 150);
}
function closeSaveHistoryModal() {
  document.getElementById('save-history-modal').classList.remove('visible');
}

// ── MODALE HISTORIQUE ──
function openHistoryModal() {
  renderHistoryList();
  document.getElementById('history-modal').classList.add('visible');
}
function closeHistoryModal() {
  document.getElementById('history-modal').classList.remove('visible');
}

function renderHistoryList() {
  const history = getHistory();
  const list = document.getElementById('history-list');
  if (!history.length) {
    list.innerHTML = '<p class="history-empty">Aucune tournée sauvegardée.<br><small>Optimisez une tournée puis cliquez sur "Sauvegarder".</small></p>';
    return;
  }
  list.innerHTML = history.map((entry, i) => {
    const date = new Date(entry.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const start = entry.startPoint ? entry.startPoint.formatted.split(',')[0] : 'Sans départ';
    return `<div class="history-entry">
      <div class="history-entry-info">
        <div class="history-entry-name">${esc(entry.name)}</div>
        <div class="history-entry-meta">${date} · ${entry.count} adresse${entry.count > 1 ? 's' : ''}</div>
        <div class="history-entry-start">&#128205; ${esc(start)}</div>
      </div>
      <div class="history-entry-actions">
        <button class="history-btn-load" onclick="loadHistoryEntry(${i})">Charger</button>
        <button class="history-btn-del" onclick="deleteHistoryEntry(${i})">&#10005;</button>
      </div>
    </div>`;
  }).join('');
}

function loadHistoryEntry(idx) {
  const history = getHistory();
  const entry = history[idx];
  if (!entry) return;

  // Reset state
  clearMarkers();
  state.deliveries = [];
  state.startPoint = null;
  state.directionsRenderer.setDirections({ routes: [] });
  if (state.previewRenderer) state.previewRenderer.setDirections({ routes: [] });
  state.navStops = null; state.navLegs = null;
  document.getElementById('results-panel').classList.remove('visible');
  document.getElementById('btn-nav-start').classList.remove('visible');
  document.getElementById('start-display').textContent = '';
  document.getElementById('start-display').classList.remove('visible');

  // Restaurer départ
  if (entry.startPoint) {
    const s = entry.startPoint;
    const marker = createClassicMarker({ lat: s.lat, lng: s.lng }, 'D', '#22c55e', 'Départ');
    state.startPoint = { ...s, marker };
    const d = document.getElementById('start-display');
    d.textContent = s.formatted; d.classList.add('visible');
    const si = document.getElementById('start-input');
    si.value = s.address; si.dataset.formatted = s.formatted;
    si.dataset.lat = s.lat; si.dataset.lng = s.lng; si.dataset.resolved = 'true';
    updateAutocompleteBias(); updateFavStar();
  }

  // Restaurer livraisons
  entry.deliveries.forEach((d, i) => {
    const marker = createClassicMarker({ lat: d.lat, lng: d.lng }, String(i + 1), '#ef4444', d.formatted);
    state.deliveries.push({ id: idCounter++, ...d, marker });
  });

  renderDeliveryList();
  saveSession();
  closeHistoryModal();
  showStatus('success', `"${entry.name}" chargée — ${entry.count} adresses`);

  if (state.startPoint) {
    state.map.panTo({ lat: state.startPoint.lat, lng: state.startPoint.lng });
    state.map.setZoom(12);
  }
}

function deleteHistoryEntry(idx) {
  const history = getHistory();
  history.splice(idx, 1);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistoryList();
}

// ── BLINK SUR TEXTE ACTION ──
function blinkAction(el, fn) {
  el.classList.remove('blink');
  void el.offsetWidth;
  el.classList.add('blink');
  el.addEventListener('animationend', () => el.classList.remove('blink'), { once: true });
  fn();
}
function triggerExport(el)  { blinkAction(el, exportRoute); }
function triggerShare(el)   { blinkAction(el, shareRouteUrl); }
function triggerSave(el)    { blinkAction(el, promptSaveHistory); }

// ── EXPORT TEXTE / PARTAGE NATIF ──
async function exportRoute() {
  if (!state.deliveries.length) return;
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const lines = [`🚚 Tournée CarGo — ${date}`, ''];
  if (state.startPoint) lines.push(`📍 Départ : ${state.startPoint.formatted}`, '');
  state.deliveries.forEach((d, i) => {
    let line = `${i + 1}. ${d.formatted}`;
    if (d.note) line += `\n   📝 ${d.note}`;
    if (d.legDist && d.legDur) line += `\n   🕐 ${d.legDist} · ${d.legDur}`;
    lines.push(line);
  });
  const text = lines.join('\n');
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Ma tournée CarGo', text });
    } else {
      await navigator.clipboard.writeText(text);
      showStatus('success', 'Tournée copiée dans le presse-papier !');
    }
  } catch { showStatus('error', 'Impossible d\'exporter.'); }
}

// ── PARTAGE PAR LIEN ──
async function shareRouteUrl() {
  if (!state.deliveries.length) return;
  const data = {
    s: state.startPoint
      ? { a: state.startPoint.address, la: state.startPoint.lat, ln: state.startPoint.lng, f: state.startPoint.formatted }
      : null,
    d: state.deliveries.map(d => ({
      a: d.address, la: d.lat, ln: d.lng, f: d.formatted,
      n: d.note || '', s: d.sector || 0, l: d.locked || false
    }))
  };
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  const url = `${location.origin}${location.pathname}?route=${encoded}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Ma tournée CarGo', url });
    } else {
      await navigator.clipboard.writeText(url);
      showStatus('success', `Lien copié — …?route=${encoded.slice(0, 8)}…`);
    }
  } catch { showStatus('error', 'Impossible de partager.'); }
}

// ── CHARGEMENT D'UNE TOURNÉE PARTAGÉE ──
function checkSharedRoute() {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('route');
  if (!encoded) return false;
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    window.history.replaceState({}, '', window.location.pathname);
    if (data.s) {
      const s = data.s;
      const marker = createClassicMarker({ lat: s.la, lng: s.ln }, 'D', '#22c55e', 'Départ');
      state.startPoint = { address: s.a, lat: s.la, lng: s.ln, formatted: s.f, marker };
      const d = document.getElementById('start-display'); d.textContent = s.f; d.classList.add('visible');
      const si = document.getElementById('start-input');
      si.value = s.a; si.dataset.formatted = s.f; si.dataset.lat = s.la; si.dataset.lng = s.ln; si.dataset.resolved = 'true';
      updateAutocompleteBias(); updateFavStar();
    }
    if (data.d && data.d.length) {
      data.d.forEach((d, i) => {
        const marker = createClassicMarker({ lat: d.la, lng: d.ln }, String(i + 1), '#ef4444', d.f);
        state.deliveries.push({ id: idCounter++, address: d.a, lat: d.la, lng: d.ln, formatted: d.f, placeName: '', note: d.n || '', sector: d.s || 0, locked: d.l || false, marker });
      });
      renderDeliveryList();
      showStatus('success', `Tournée partagée chargée — ${data.d.length} adresses !`);
    }
    return true;
  } catch { return false; }
}
