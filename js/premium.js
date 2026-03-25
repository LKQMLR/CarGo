/* ══════════════════════════════════════════
   CarGo — Système Premium (Stripe)
   Gestion abonnement, vérification, UI
   ══════════════════════════════════════════ */

const CARGO_API = 'https://cargo-api-yzcq.vercel.app';
const STRIPE_PK = 'pk_test_51TEmxoIPUomr66UcUNlLZee6odxyWVqx7w2CxPMCECIgAeewj6DdhUyb5ck6jRiflJe7iyH1IpPu1GpYVsIf3EYe00vCX0TuxI';

// ── Vérifier le statut premium au lancement ──
function initPremium() {
  const email = localStorage.getItem('cargo_premium_email');
  const cached = localStorage.getItem('cargo_premium_status');

  // Vérifier si on revient d'un paiement réussi
  const params = new URLSearchParams(window.location.search);
  if (params.get('premium') === 'success') {
    // Nettoyer l'URL
    window.history.replaceState({}, '', window.location.pathname);
    if (email) {
      checkPremiumStatus(email);
      showStatus('success', 'Bienvenue dans CarGo Premium !');
    }
  } else if (params.get('premium') === 'cancel') {
    window.history.replaceState({}, '', window.location.pathname);
  }

  // Appliquer le cache local en attendant la vérification serveur
  if (cached === 'true') {
    applyPremium(true);
  }

  // Vérifier côté serveur si on a un email
  if (email) {
    checkPremiumStatus(email);
  }

  updatePremiumUI();
}

// ── Vérifier l'abonnement côté serveur ──
async function checkPremiumStatus(email) {
  try {
    const res = await fetch(`${CARGO_API}/api/check-subscription?email=${encodeURIComponent(email)}`);
    if (!res.ok) return;
    const data = await res.json();
    localStorage.setItem('cargo_premium_status', data.premium ? 'true' : 'false');
    applyPremium(data.premium);
  } catch {
    // En cas d'erreur réseau, garder le statut en cache
  }
}

// ── Appliquer le mode premium ──
function applyPremium(isPremium) {
  // Masquer/afficher les pubs
  const adBanner = document.getElementById('ad-banner');
  if (adBanner) adBanner.style.display = isPremium ? 'none' : '';

  // Mettre à jour le badge
  const badge = document.getElementById('premium-badge');
  if (badge) badge.style.display = isPremium ? 'inline-flex' : 'none';

  // Mettre à jour le bouton
  updatePremiumUI();
}

// ── Mettre à jour l'UI du bouton premium ──
function updatePremiumUI() {
  const btn = document.getElementById('btn-premium');
  if (!btn) return;

  const email = localStorage.getItem('cargo_premium_email');
  const isPremium = localStorage.getItem('cargo_premium_status') === 'true';

  if (isPremium) {
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Premium actif';
    btn.classList.add('premium-active');
    btn.onclick = managePremium;
  } else {
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Passer Premium';
    btn.classList.remove('premium-active');
    btn.onclick = showPremiumModal;
  }
}

// ── Afficher la modale d'abonnement ──
function showPremiumModal() {
  // Supprimer une modale existante
  const old = document.getElementById('premium-modal');
  if (old) old.remove();

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
      <p class="premium-price">4,99\u20ac<span>/mois</span></p>
      <ul class="premium-perks">
        <li>Aucune publicit\u00e9</li>
        <li>Soutenir le d\u00e9veloppement</li>
        <li>Fonctionnalit\u00e9s futures en priorit\u00e9</li>
      </ul>
      <input type="email" id="premium-email" placeholder="Votre adresse email" value="${localStorage.getItem('cargo_premium_email') || ''}" />
      <button class="premium-subscribe" onclick="subscribePremium()">S'abonner</button>
      <p class="premium-legal">Paiement s\u00e9curis\u00e9 via Stripe. Annulable \u00e0 tout moment.</p>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));
}

// ── Fermer la modale ──
function closePremiumModal() {
  const modal = document.getElementById('premium-modal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }
}

// ── Lancer le paiement Stripe ──
async function subscribePremium() {
  const emailInput = document.getElementById('premium-email');
  const email = emailInput.value.trim();

  if (!email || !email.includes('@')) {
    emailInput.style.borderColor = '#ef4444';
    return;
  }

  // Sauvegarder l'email
  localStorage.setItem('cargo_premium_email', email);

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

    // Rediriger vers Stripe Checkout
    window.location.href = data.url;
  } catch (err) {
    btn.textContent = "S'abonner";
    btn.disabled = false;
    showStatus('error', 'Erreur de connexion au serveur de paiement');
  }
}

// ── Gérer l'abonnement existant ──
function managePremium() {
  const email = localStorage.getItem('cargo_premium_email');
  if (confirm(`Abonnement Premium actif (${email}).\n\nPour gérer ou annuler votre abonnement, rendez-vous sur le portail Stripe.`)) {
    // On pourrait rediriger vers le Stripe Customer Portal
  }
}
