/* ══════════════════════════════════════════
   CarGo — Système Premium (Stripe)
   Gestion abonnement, vérification, UI
   ══════════════════════════════════════════ */

const CARGO_API = 'https://cargo-api-seven.vercel.app';
const STRIPE_PK = 'pk_live_51TEmxgRKxWKosInIe4Dbq4b13mbpMOrQabMsIy2B7pOYJKVw6FRSiDOjAwsaG3vhTL0RLwn22qeDns7afLlPlh3z00JJMuTqFx';

// État premium en mémoire — seul le serveur peut le mettre à true
let _premiumVerified = false;

// ── Vérifier le statut premium au lancement ──
function initPremium() {
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
function applyPremium(isPremium) {
  const adBanner = document.getElementById('ad-banner');
  if (adBanner) adBanner.style.display = isPremium ? 'none' : '';

  const badge = document.getElementById('premium-badge');
  if (badge) badge.style.display = isPremium ? 'inline-flex' : 'none';

  updatePremiumUI(isPremium);
}

// ── Mettre à jour l'UI du bouton premium ──
function updatePremiumUI(isPremium) {
  const btn = document.getElementById('btn-premium');
  if (!btn) return;

  // Utiliser l'état mémoire, jamais localStorage
  const premium = typeof isPremium === 'boolean' ? isPremium : _premiumVerified;

  if (premium) {
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Premium actif';
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
      <p class="premium-price">6,99\u20ac<span>/mois</span></p>
      <ul class="premium-perks">
        <li>Aucune publicit\u00e9</li>
        <li>Soutenir le d\u00e9veloppement</li>
        <li>Fonctionnalit\u00e9s futures en priorit\u00e9</li>
      </ul>
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

    if (!res.ok) throw new Error('Erreur serveur');
    const data = await res.json();
    window.location.href = data.url;
  } catch (err) {
    btn.textContent = "S'abonner";
    btn.disabled = false;
    localStorage.removeItem('cargo_pending_email');
    showStatus('error', 'Erreur de connexion au serveur de paiement');
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
