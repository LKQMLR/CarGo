/* ══════════════════════════════════════════
   CarGo — Système Premium (Stripe)
   Gestion abonnement, vérification, UI,
   limites freemium
   ══════════════════════════════════════════ */

const CARGO_API = 'https://cargo-api-seven.vercel.app';
const STRIPE_PK = 'pk_live_51TEmxgRKxWKosInIe4Dbq4b13mbpMOrQabMsIy2B7pOYJKVw6FRSiDOjAwsaG3vhTL0RLwn22qeDns7afLlPlh3z00JJMuTqFx';

// Hash SHA-256 des emails propriétaire (premium gratuit, non lisible)
const OWNER_HASHES = ['10780fdbd1fbc4d15ff792fa79466263f73f368bde5a3a3d0032d2ed69afdf46'];

// État premium en mémoire — seul le serveur peut le mettre à true
let _premiumVerified = false;

// Données d'abonnement enrichies (date de fin, annulation en cours…)
window._subscriptionData = { active: false, currentPeriodEnd: null, cancelAtPeriodEnd: false };

// ── SHA-256 hash ──
async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function isOwnerEmail(email) {
  const hash = await sha256(email.toLowerCase());
  return OWNER_HASHES.includes(hash);
}

// ── Vérifier si l'utilisateur est premium ──
function isPremium() {
  return _premiumVerified;
}

// ── Limites par plan ──
const FREE_LIMITS = {
  maxAddresses: 10,
  maxSectors: 2,      // secteurs 1 et 2
  maxLocks: 1,
  proximityAlerts: false,
};

function checkAddressLimit() {
  if (isPremium()) return true;
  if (state.deliveries.length >= FREE_LIMITS.maxAddresses) {
    showLimitAlert('adresses', `${FREE_LIMITS.maxAddresses} adresses max en version gratuite.`);
    return false;
  }
  return true;
}

function checkSectorLimit(sectorNum) {
  if (isPremium()) return true;
  if (sectorNum > FREE_LIMITS.maxSectors) {
    showLimitAlert('secteurs', `Secteurs 1 et 2 uniquement en version gratuite.`);
    return false;
  }
  return true;
}

function checkLockLimit() {
  if (isPremium()) return true;
  const currentLocks = state.deliveries.filter(d => d.locked).length;
  if (currentLocks >= FREE_LIMITS.maxLocks) {
    showLimitAlert('verrouillage', `${FREE_LIMITS.maxLocks} verrouillage max en version gratuite.`);
    return false;
  }
  return true;
}

function canUseProximityAlerts() {
  return isPremium() || FREE_LIMITS.proximityAlerts;
}

let _lastLimitAlert = 0;
function showLimitAlert(_, message) {
  const now = Date.now();
  if (now - _lastLimitAlert < 2000) return; // Anti-spam
  _lastLimitAlert = now;
  showStatus('error', message + ' Découvrez l\'offre Standard.');
  const btn = document.getElementById('btn-premium');
  if (btn) {
    btn.classList.remove('premium-pulse');
    void btn.offsetWidth; // Force reflow pour relancer l'animation
    btn.classList.add('premium-pulse');
    setTimeout(() => btn.classList.remove('premium-pulse'), 2000);
  }
}

// ── Vérifier le statut premium au lancement ──
function initPremium() {
  // Par défaut : pas premium — l'auth listener déclenche checkPremiumStatus si l'utilisateur est connecté
  _premiumVerified = false;
  applyPremium(false);
}

// ── Vérifier l'abonnement côté serveur ──
async function checkPremiumStatus(email) {
  // Ne pas vérifier côté serveur si c'est un email propriétaire
  if (await isOwnerEmail(email)) {
    _premiumVerified = true;
    window._subscriptionData = { active: true, currentPeriodEnd: null, cancelAtPeriodEnd: false, isOwner: true };
    applyPremium(true);
    if (typeof updateAuthUI === 'function') updateAuthUI();
    return;
  }
  try {
    const res = await fetch(`${CARGO_API}/api/check-subscription?email=${encodeURIComponent(email)}`);
    if (!res.ok) {
      applyPremium(false);
      return;
    }
    const data = await res.json();
    _premiumVerified = !!data.premium;
    window._subscriptionData = {
      active:            !!data.premium,
      currentPeriodEnd:  data.currentPeriodEnd  || null,
      cancelAtPeriodEnd: !!data.cancelAtPeriodEnd,
    };
    applyPremium(_premiumVerified);
    if (typeof updateAuthUI === 'function') updateAuthUI();
  } catch {
    // Erreur réseau — rester sur non-premium par sécurité
    applyPremium(false);
  }
}

// ── Appliquer le mode premium ──
function applyPremium(active) {
  const adBanner = document.getElementById('ad-banner');
  if (adBanner) adBanner.style.display = active ? 'none' : '';

  const badge = document.getElementById('premium-badge');
  if (badge) badge.style.display = active ? 'inline-flex' : 'none';

  // Désactiver les alertes de proximité pour les gratuits
  const proxCheck = document.getElementById('prox-check');
  const proxToggle = document.getElementById('prox-toggle');
  if (proxCheck && proxToggle) {
    const proxLabel = proxToggle.querySelector('label');
    if (!active) {
      proxCheck.checked = false;
      proxCheck.disabled = true;
      if (proxLabel) proxLabel.style.opacity = '.5';
      proxToggle.title = 'Fonctionnalit\u00e9 Premium';
    } else {
      proxCheck.disabled = false;
      if (proxLabel) proxLabel.style.opacity = '';
      proxToggle.title = '';
    }
  }

  updatePremiumUI(active);
}

// ── Mettre à jour l'UI du bouton premium ──
function updatePremiumUI(isPremium) {
  const btn = document.getElementById('btn-premium');
  if (!btn) return;

  // Utiliser l'état mémoire, jamais localStorage
  const premium = typeof isPremium === 'boolean' ? isPremium : _premiumVerified;

  if (premium) {
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Standard actif — G\u00e9rer';
    btn.classList.add('premium-active');
    btn.onclick = managePremium;
  } else {
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Passer Standard';
    btn.classList.remove('premium-active');
    btn.onclick = showPremiumModal;
  }
}

// ── Échappement HTML ──
function escHtml(s) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(s || ''));
  return d.innerHTML;
}

// ── Afficher la modale d'abonnement ──
function showPremiumModal() {
  const old = document.getElementById('premium-modal');
  if (old) old.remove();

  const authUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const savedEmail = escHtml(authUser?.email || '');
  const emailReadonly = authUser ? 'readonly style="opacity:.6;cursor:default"' : '';

  const modal = document.createElement('div');
  modal.id = 'premium-modal';
  modal.innerHTML = `
    <div class="premium-overlay" onclick="closePremiumModal()"></div>
    <div class="premium-content">
      <button class="premium-close" onclick="closePremiumModal()">&times;</button>
      <div class="premium-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </div>
      <h3>Choisissez votre offre</h3>
      <div class="premium-compare">
        <div class="premium-col">
          <div class="premium-col-title">Gratuit</div>
          <div class="premium-col-price">0\u20ac<span>/mois</span></div>
          <ul>
            <li>10 adresses max</li>
            <li>Secteurs 1 et 2</li>
            <li>1 verrouillage</li>
            <li class="premium-no">Alertes proximit\u00e9</li>
            <li class="premium-no">Sans publicit\u00e9</li>
          </ul>
        </div>
        <div class="premium-col premium-col-standard">
          <div class="premium-col-badge">Populaire</div>
          <div class="premium-col-title">Standard</div>
          <div class="premium-col-price">12,99\u20ac<span>/mois</span></div>
          <ul>
            <li>Adresses illimit\u00e9es</li>
            <li>Tous les secteurs</li>
            <li>Verrouillages illimit\u00e9s</li>
            <li>Alertes de proximit\u00e9</li>
            <li>Sans publicit\u00e9</li>
          </ul>
        </div>
        <div class="premium-col premium-col-elite">
          <div class="premium-col-title">Pro</div>
          <div class="premium-col-price">24,99\u20ac<span>/mois</span></div>
          <ul>
            <li>Tout du Standard</li>
            <li>Multi-tourn\u00e9es</li>
            <li>Statistiques</li>
            <li>Support prioritaire</li>
            <li class="premium-soon">\u2022 Plus encore</li>
          </ul>
        </div>
      </div>
      <input type="email" id="premium-email" placeholder="Votre adresse email" value="${savedEmail}" ${emailReadonly} />
      <button class="premium-subscribe" onclick="subscribePremium()">S\u2019abonner \u2014 Standard 12,99\u20ac/mois</button>
      <button class="premium-coming-soon" disabled>Pro 24,99\u20ac/mois \u2014 Bient\u00f4t disponible</button>
      <button class="premium-coming-soon" disabled>Passe journ\u00e9e 1,99\u20ac \u2014 Bient\u00f4t disponible</button>
      <p class="premium-legal">Paiement s\u00e9curis\u00e9 via Stripe. Annulable \u00e0 tout moment.</p>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));
}

function closePremiumModal() {
  const modal = document.getElementById('premium-modal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }
}

// ── Validation email ──
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Lancer le paiement Stripe ──
async function subscribePremium() {
  // Priorité à l'email du compte connecté
  const authUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const emailInput = document.getElementById('premium-email');
  const email = authUser ? authUser.email : emailInput?.value.trim();

  if (!email || !isValidEmail(email)) {
    if (emailInput) emailInput.style.borderColor = '#ef4444';
    return;
  }

  // Bypass propriétaire : activer premium sans payer
  if (await isOwnerEmail(email)) {
    _premiumVerified = true;
    applyPremium(true);
    closePremiumModal();
    showStatus('success', 'Premium activ\u00e9 !');
    return;
  }

  const btn = document.querySelector('.premium-subscribe');
  btn.textContent = 'Redirection...';
  btn.disabled = true;

  try {
    const res = await fetch(`${CARGO_API}/api/create-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');
    if (!data.url) throw new Error('URL de paiement manquante');
    window.location.href = data.url;
  } catch (err) {
    btn.textContent = "S'abonner";
    btn.disabled = false;
    showStatus('error', 'Erreur paiement : ' + (err.message || 'connexion impossible'));
  }
}

// ── Gérer l'abonnement existant ──
async function managePremium() {
  const authUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const email = authUser?.email;
  if (!email) {
    showStatus('error', 'Connectez-vous pour gérer votre abonnement.');
    return;
  }
  // Les emails owner : toggle premium on/off
  if (await isOwnerEmail(email)) {
    _premiumVerified = false;
    applyPremium(false);
    showStatus('success', 'Premium d\u00e9sactiv\u00e9. Cliquez sur "Passer Premium" pour r\u00e9activer.');
    return;
  }
  try {
    const res = await fetch(`${CARGO_API}/api/customer-portal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    window.location.href = data.url;
  } catch {
    showStatus('error', 'Impossible d\'ouvrir le portail de gestion');
  }
}
