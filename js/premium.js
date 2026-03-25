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
  maxAddresses: 20,
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

function showLimitAlert(_, message) {
  showStatus('error', message + ' Passez Premium !');
  // Clignoter le bouton premium
  const btn = document.getElementById('btn-premium');
  if (btn) {
    btn.classList.add('premium-pulse');
    setTimeout(() => btn.classList.remove('premium-pulse'), 2000);
  }
}

// ── Vérifier le statut premium au lancement ──
function initPremium() {
  // Vérifier si email propriétaire
  const ownerEmail = localStorage.getItem('cargo_premium_email');
  if (ownerEmail) {
    isOwnerEmail(ownerEmail).then(isOwner => {
      if (isOwner) { _premiumVerified = true; applyPremium(true); }
    });
  }

  // Par défaut : pas premium
  _premiumVerified = false;
  applyPremium(false);

  // Vérifier si on revient d'un paiement réussi
  const params = new URLSearchParams(window.location.search);
  if (params.get('premium') === 'success') {
    window.history.replaceState({}, '', window.location.pathname);
    // Récupérer l'email temporaire (localStorage car sessionStorage peut être perdu après redirect)
    const pendingEmail = localStorage.getItem('cargo_pending_email');
    if (pendingEmail) {
      localStorage.setItem('cargo_premium_email', pendingEmail);
      localStorage.removeItem('cargo_pending_email');
    }
    const confirmedEmail = localStorage.getItem('cargo_premium_email');
    if (confirmedEmail) {
      checkPremiumStatus(confirmedEmail);
      showStatus('success', 'Vérification de votre abonnement...');
    }
  } else if (params.get('premium') === 'cancel') {
    window.history.replaceState({}, '', window.location.pathname);
    localStorage.removeItem('cargo_pending_email');
  }

  // Vérifier côté serveur si on a un email enregistré
  const email = localStorage.getItem('cargo_premium_email');
  if (email) {
    checkPremiumStatus(email);
  }
}

// ── Vérifier l'abonnement côté serveur ──
async function checkPremiumStatus(email) {
  // Ne pas vérifier côté serveur si c'est un email propriétaire
  if (await isOwnerEmail(email)) { _premiumVerified = true; applyPremium(true); return; }
  try {
    const res = await fetch(`${CARGO_API}/api/check-subscription?email=${encodeURIComponent(email)}`);
    if (!res.ok) {
      applyPremium(false);
      return;
    }
    const data = await res.json();
    _premiumVerified = !!data.premium;
    applyPremium(_premiumVerified);
    // Si plus premium, nettoyer
    if (!data.premium) {
      localStorage.removeItem('cargo_premium_email');
    }
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
    if (!active) {
      proxCheck.checked = false;
      proxCheck.disabled = true;
      proxToggle.style.opacity = '.5';
      proxToggle.title = 'Fonctionnalit\u00e9 Premium';
    } else {
      proxCheck.disabled = false;
      proxToggle.style.opacity = '';
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
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Premium actif — G\u00e9rer';
    btn.classList.add('premium-active');
    btn.onclick = managePremium;
  } else {
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Passer Premium';
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

  const savedEmail = escHtml(localStorage.getItem('cargo_premium_email') || '');

  const modal = document.createElement('div');
  modal.id = 'premium-modal';
  modal.innerHTML = `
    <div class="premium-overlay" onclick="closePremiumModal()"></div>
    <div class="premium-content">
      <button class="premium-close" onclick="closePremiumModal()">&times;</button>
      <div class="premium-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </div>
      <h3>CarGo Premium</h3>
      <p class="premium-price">11,99\u20ac<span>/mois</span></p>
      <div class="premium-compare">
        <div class="premium-col">
          <div class="premium-col-title">Gratuit</div>
          <ul>
            <li>20 adresses max</li>
            <li>Secteurs 1 et 2</li>
            <li>1 verrouillage</li>
            <li class="premium-no">Alertes de proximit\u00e9</li>
            <li class="premium-no">Publicit\u00e9s</li>
          </ul>
        </div>
        <div class="premium-col premium-col-pro">
          <div class="premium-col-title">Premium</div>
          <ul>
            <li>Adresses illimit\u00e9es</li>
            <li>Tous les secteurs</li>
            <li>Verrouillages illimit\u00e9s</li>
            <li>Alertes de proximit\u00e9</li>
            <li>Aucune publicit\u00e9</li>
          </ul>
        </div>
      </div>
      <input type="email" id="premium-email" placeholder="Votre adresse email" value="${savedEmail}" />
      <button class="premium-subscribe" onclick="subscribePremium()">S'abonner</button>
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
  const emailInput = document.getElementById('premium-email');
  const email = emailInput.value.trim();

  if (!email || !isValidEmail(email)) {
    emailInput.style.borderColor = '#ef4444';
    return;
  }

  // Bypass propriétaire : activer premium sans payer
  if (await isOwnerEmail(email)) {
    localStorage.setItem('cargo_premium_email', email);
    _premiumVerified = true;
    applyPremium(true);
    closePremiumModal();
    showStatus('success', 'Premium activ\u00e9 !');
    return;
  }

  // Sauver dans localStorage (survit aux redirections cross-origin, contrairement à sessionStorage)
  localStorage.setItem('cargo_pending_email', email);

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
    localStorage.removeItem('cargo_pending_email');
    showStatus('error', 'Erreur paiement : ' + (err.message || 'connexion impossible'));
  }
}

// ── Gérer l'abonnement existant ──
async function managePremium() {
  const email = localStorage.getItem('cargo_premium_email');
  if (!email) {
    showStatus('error', 'Aucun email associé au premium');
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
