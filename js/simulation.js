/* ══════════════════════════════════════════
   CarGo — Mode Simulation
   Simule un déplacement GPS le long de la route
   Activé en cliquant sur le numéro de version
   ══════════════════════════════════════════ */

let _simMode = false, _simInterval = null, _simPathIdx = 0, _simPath = [];

function toggleSimMode() {
  _simMode = !_simMode;
  const tag = document.getElementById('version-tag');
  if (_simMode) {
    tag.style.color = '#ef4444';
    tag.textContent = tag.textContent.replace(' [SIM]', '') + ' [SIM]';
    showStatus('success', 'Mode simulation activé. Lancez une tournée pour simuler le trajet.');
  } else {
    stopSim();
    tag.style.color = '';
    tag.textContent = tag.textContent.replace(' [SIM]', '');
    showStatus('success', 'Mode simulation désactivé.');
  }
}

function startSim() {
  if (!_simMode || !state.navLegs) return;
  _simPath = [];
  // Construire le chemin à partir de toutes les étapes
  state.navLegs.forEach(leg => {
    if (leg.steps) leg.steps.forEach(step => {
      step.path.forEach(p => _simPath.push({ lat: p.lat(), lng: p.lng() }));
    });
  });
  if (!_simPath.length) return;
  _simPathIdx = 0;
  _simInterval = setInterval(() => {
    if (_simPathIdx >= _simPath.length) { stopSim(); return; }
    const p = _simPath[_simPathIdx];
    updateGPSPosition({ latitude: p.lat, longitude: p.lng, accuracy: 10 });
    _simPathIdx += 12; // Vitesse : saute 12 points par tick
  }, 200);
}

function resumeSim() {
  if (!_simPath.length || _simPathIdx >= _simPath.length) return;
  _simInterval = setInterval(() => {
    if (_simPathIdx >= _simPath.length) { stopSim(); return; }
    const p = _simPath[_simPathIdx];
    updateGPSPosition({ latitude: p.lat, longitude: p.lng, accuracy: 10 });
    _simPathIdx += 12;
  }, 200);
}

function stopSim() {
  if (_simInterval) { clearInterval(_simInterval); _simInterval = null; }
}
