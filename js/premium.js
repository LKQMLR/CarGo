/* ══════════════════════════════════════════
   CarGo — Système Premium (Stripe)
   Gestion abonnement, vérification, UI,
   limites freemium
   ══════════════════════════════════════════ */

const CARGO_API = 'https://cargo-api-fresh.vercel.app';
const STRIPE_PK = 'pk_live_51TEmxgRKxWKosInIe4Dbq4b13mbpMOrQabMsIy2B7pOYJKVw6FRSiDOjAwsaG3vhTL0RLwn22qeDns7afLlPlh3z00JJMuTqFx';

// État premium — valeur privée non accessible directement depuis la console
const _premiumState = (() => { let _v = false; return { get: () => _v, set: (v) => { _v = (v === true); } }; })();

// Données d'abonnement enrichies (date de fin, annulation en cours…)
window._subscriptionData = { active: false, currentPeriodEnd: null, cancelAtPeriodEnd: false };

// ── Vérifier si l'utilisateur est premium ──
function isPremium() {
  return _premiumState.get();
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
  _premiumState.set(false);
  applyPremium(false);
}

// ── Vérifier l'abonnement côté serveur ──
async function checkPremiumStatus(email) {
  try {
    const res = await fetch(`${CARGO_API}/api/check-subscription?email=${encodeURIComponent(email)}`);
    if (!res.ok) {
      applyPremium(false);
      return;
    }
    const data = await res.json();
    _premiumState.set(!!data.premium);
    window._subscriptionData = {
      active:            !!data.premium,
      currentPeriodEnd:  data.currentPeriodEnd  || null,
      cancelAtPeriodEnd: !!data.cancelAtPeriodEnd,
    };
    applyPremium(_premiumState.get());
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
  const premium = typeof isPremium === 'boolean' ? isPremium : _premiumState.get();

  if (premium) {
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Standard actif \u2014 G\u00e9rer';
    btn.classList.add('premium-active');
    btn.onclick = managePremium;
  } else {
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Formule d\u2019abonnement';
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
  const authUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  if (!authUser) {
    if (typeof openAuthModal === 'function') openAuthModal('signin');
    if (typeof showStatus === 'function') showStatus('error', 'Connecte-toi pour accéder aux formules d\'abonnement.');
    return;
  }

  const old = document.getElementById('premium-modal');
  if (old) old.remove();
  const savedEmail = escHtml(authUser?.email || '');
  const emailReadonly = authUser ? 'readonly style="opacity:.6;cursor:default"' : '';

  const modal = document.createElement('div');
  modal.id = 'premium-modal';
  modal.innerHTML = `
    <div class="premium-overlay" onclick="closePremiumModal()"></div>
    <div class="premium-content">
      <button class="premium-close" onclick="closePremiumModal()">&times;</button>
      <h3>Choisissez votre offre</h3>
      <div class="premium-plans">
        <div class="premium-plan selected" data-plan="standard" onclick="selectPlan('standard')">
          <div class="premium-plan-name">Standard</div>
          <div class="premium-plan-price">12,99\u20ac<span>/mois</span></div>
          <ul>
            <li>Adresses illimit\u00e9es</li>
            <li>Tous les secteurs</li>
            <li>Verrouillages illimit\u00e9s</li>
            <li>Alertes de proximit\u00e9</li>
            <li>Sans publicit\u00e9</li>
          </ul>
        </div>
        <div class="premium-plan disabled" data-plan="pro">
          <div class="premium-plan-badge">Bient\u00f4t</div>
          <div class="premium-plan-name">Pro</div>
          <div class="premium-plan-price">24,99\u20ac<span>/mois</span></div>
          <ul>
            <li>Tout du Standard</li>
            <li>Multi-tourn\u00e9es</li>
            <li>Statistiques</li>
            <li>Support prioritaire</li>
          </ul>
        </div>
      </div>
      <div class="premium-daypass">
        <div class="premium-daypass-info">
          <span class="premium-daypass-name">Passe journ\u00e9e</span>
          <span class="premium-daypass-desc">Profitez de tout en illimit\u00e9 pendant 24h</span>
        </div>
        <span class="premium-daypass-price">1,99\u20ac</span>
        <span class="premium-daypass-soon">Bient\u00f4t</span>
      </div>
      <input type="email" id="premium-email" placeholder="Votre adresse email" value="${savedEmail}" ${emailReadonly} />
      <button class="premium-subscribe" onclick="subscribePremium()">S\u2019abonner</button>
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

function selectPlan(plan) {
  document.querySelectorAll('.premium-plan:not(.disabled)').forEach(el => {
    el.classList.toggle('selected', el.dataset.plan === plan);
  });
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

  const btn = document.querySelector('.premium-subscribe');
  btn.textContent = 'Redirection...';
  btn.disabled = true;

  try {
    const token = typeof getAuthToken === 'function' ? await getAuthToken() : null;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${CARGO_API}/api/create-checkout?email=${encodeURIComponent(email)}`, { headers });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');
    // Propriétaire reconnu côté serveur
    if (data.owner) {
      _premiumState.set(true);
      applyPremium(true);
      closePremiumModal();
      if (typeof showStatus === 'function') showStatus('success', 'Premium activé !');
      btn.textContent = "S'abonner"; btn.disabled = false;
      return;
    }
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
  try {
    const token = typeof getAuthToken === 'function' ? await getAuthToken() : null;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${CARGO_API}/api/customer-portal?email=${encodeURIComponent(email)}`, { headers });
    if (!res.ok) throw new Error();
    const data = await res.json();
    window.location.href = data.url;
  } catch {
    showStatus('error', 'Impossible d\'ouvrir le portail de gestion');
  }
}
