/* ══════════════════════════════════════════
   CarGo — Authentification Supabase
   Gestion session, connexion, inscription, UI
   ══════════════════════════════════════════ */

const SUPABASE_URL     = 'https://wzhhxfrbmsmygozqvuvk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1V209cHQnuROD-mAzqg74g_p-2-HbTy';

let _supabase = null;
let _authUser = null;

// ── Initialisation ──
function initAuth() {
  const { createClient } = window.supabase;
  _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Écouter les changements d'état auth
  _supabase.auth.onAuthStateChange((event, session) => {
    _authUser = session?.user || null;
    updateAuthUI();
    if (_authUser) {
      if (typeof checkPremiumStatus === 'function') checkPremiumStatus(_authUser.email);
    } else {
      if (typeof applyPremium === 'function') applyPremium(false);
    }
  });

  // Récupérer la session existante au lancement
  _supabase.auth.getSession().then(({ data: { session } }) => {
    _authUser = session?.user || null;
    updateAuthUI();
    if (_authUser) {
      if (typeof checkPremiumStatus === 'function') checkPremiumStatus(_authUser.email);
    }
    // Gérer le retour depuis Stripe
    const params = new URLSearchParams(window.location.search);
    if (params.get('premium') === 'success') {
      window.history.replaceState({}, '', window.location.pathname);
      if (_authUser) {
        if (typeof checkPremiumStatus === 'function') checkPremiumStatus(_authUser.email);
        if (typeof showStatus === 'function') showStatus('success', 'Vérification de votre abonnement…');
      }
    } else if (params.get('premium') === 'cancel') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  });
}

// ── Accesseur utilisateur courant ──
function getAuthUser() {
  return _authUser;
}

// ── Connexion ──
async function authSignIn(email, password) {
  const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
  return { user: data?.user || null, error };
}

// ── Inscription ──
async function authSignUp(email, password) {
  const { data, error } = await _supabase.auth.signUp({ email, password });
  return { user: data?.user || null, error };
}

// ── Déconnexion ──
async function authSignOut() {
  await _supabase.auth.signOut();
  window.location.reload();
}

// ── Mettre à jour le bouton compte dans le header ──
function updateAuthUI() {
  const btn = document.getElementById('btn-account');
  if (!btn) return;
  if (_authUser) {
    const email = _authUser.email || '';
    const display = email.length > 22 ? email.slice(0, 19) + '…' : email;
    btn.innerHTML = `${display}<span class="account-dot connected"></span>`;
    btn.title = email;
    btn.classList.add('logged-in');
  } else {
    btn.innerHTML = `Connexion<span class="account-dot"></span>`;
    btn.title = '';
    btn.classList.remove('logged-in');
  }
}

// ── Ouvrir/fermer le menu compte ──
function openAccountMenu() {
  if (!_authUser) { openAuthModal('signin'); return; }

  const old = document.getElementById('account-menu');
  if (old) { old.remove(); return; }

  const btn  = document.getElementById('btn-account');
  const rect = btn.getBoundingClientRect();
  const sub  = window._subscriptionData || {};

  // Ligne statut abonnement
  const statusDot   = sub.active ? '<span class="sub-dot active"></span>' : '<span class="sub-dot"></span>';
  const statusLabel = sub.active
    ? (sub.cancelAtPeriodEnd ? 'Premium — annulation en cours' : 'Premium actif')
    : 'Gratuit';

  // Date de fin
  let endLine = '';
  if (sub.active && sub.currentPeriodEnd) {
    const d = new Date(sub.currentPeriodEnd * 1000);
    const fmt = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    endLine = `<div class="account-menu-end">${sub.cancelAtPeriodEnd ? 'Expire le' : 'Renouvellement le'} ${fmt}</div>`;
  }

  // Bouton désabonnement (visible si premium actif et pas encore en annulation)
  const cancelBtn = (sub.active && !sub.cancelAtPeriodEnd)
    ? `<button class="account-menu-btn account-menu-cancel" onclick="openCancelModal()">Se désabonner</button>`
    : '';

  // Bouton upgrade si gratuit
  const upgradeBtn = !sub.active
    ? `<button class="account-menu-btn account-menu-upgrade" onclick="document.getElementById('account-menu')?.remove();showPremiumModal()">Passer Premium</button>`
    : '';

  const menu = document.createElement('div');
  menu.id = 'account-menu';
  menu.className = 'account-menu';
  menu.style.top  = (rect.bottom + 6) + 'px';
  menu.style.left = rect.left + 'px';
  menu.innerHTML = `
    <div class="account-menu-email">${_authUser.email}</div>
    <div class="account-menu-sub">
      <span class="account-menu-sub-row">${statusDot}${statusLabel}</span>
      ${endLine}
    </div>
    ${cancelBtn}
    ${upgradeBtn}
    <button class="account-menu-btn account-menu-logout"
      onclick="authSignOut();document.getElementById('account-menu')?.remove()">
      Se déconnecter
    </button>
  `;

  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.remove();
        document.removeEventListener('click', handler);
      }
    }, { capture: true });
  }, 0);

  document.body.appendChild(menu);
}

// ── Modale confirmation désabonnement ──
function openCancelModal() {
  document.getElementById('account-menu')?.remove();
  const sub = window._subscriptionData || {};
  const endLine = sub.currentPeriodEnd
    ? `<p class="cancel-end-date">Votre abonnement prendra fin le&nbsp;:<br><strong>${new Date(sub.currentPeriodEnd * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></p>`
    : '';

  const modal = document.createElement('div');
  modal.id = 'cancel-sub-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box cancel-box">
      <div class="cancel-header">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M16 16s-1.5-2-4-2-4 2-4 2"/>
          <line x1="9" x2="9.01" y1="9" y2="9"/>
          <line x1="15" x2="15.01" y1="9" y2="9"/>
        </svg>
        <span>Vous nous quittez&nbsp;?</span>
      </div>
      ${endLine}
      <div class="cancel-actions">
        <button class="cancel-btn-keep" onclick="document.getElementById('cancel-sub-modal')?.remove()">Garder Premium</button>
        <button class="cancel-btn-unsub" id="btn-confirm-cancel" onclick="confirmCancelSubscription()">Se désabonner</button>
        <p class="cancel-legal">*aucun remboursement ne peut être fait pour la période en cours</p>
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('visible'));
}

async function confirmCancelSubscription() {
  const btn = document.getElementById('btn-confirm-cancel');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  const email = _authUser?.email;
  if (!email) return;

  try {
    const CARGO_API = typeof window.CARGO_API !== 'undefined' ? window.CARGO_API
      : 'https://cargo-api-seven.vercel.app';
    const res = await fetch(`${CARGO_API}/api/cancel-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    console.log('[cancel-sub] status:', res.status, 'body:', data);
    if (res.status === 404) throw new Error('no_sub');
    if (!res.ok) throw new Error(data.error || 'server_' + res.status);
    document.getElementById('cancel-sub-modal')?.remove();
    window._subscriptionData.cancelAtPeriodEnd = true;
    updateAuthUI();
    if (typeof showStatus === 'function') showStatus('success', 'Désabonnement confirmé. Premium actif jusqu\'à la fin de la période.');
  } catch (err) {
    console.error('[cancel-sub] erreur:', err.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Se désabonner'; }
    const msg = err.message === 'no_sub'
      ? 'Aucun abonnement Stripe trouvé pour ce compte.'
      : 'Erreur — réessaie ou contacte le support.';
    if (typeof showStatus === 'function') showStatus('error', msg);
  }
}

// ── Modale auth (connexion / inscription) ──
function openAuthModal(tab) {
  if (!tab) tab = 'signin';
  const old = document.getElementById('auth-modal');
  if (old) old.remove();

  const isSignin = tab === 'signin';
  const modal = document.createElement('div');
  modal.id = 'auth-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box auth-box">
      <div class="auth-title">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
        </svg>
        ${isSignin ? 'Connexion' : 'Créer un compte'}
      </div>
      <div id="auth-error" class="auth-error" style="display:none;"></div>
      <input type="email"    id="auth-email"    placeholder="Adresse email"  autocomplete="email" />
      <input type="password" id="auth-password" placeholder="Mot de passe"
        autocomplete="${isSignin ? 'current-password' : 'new-password'}" />
      ${!isSignin ? `<input type="password" id="auth-password2" placeholder="Confirmer le mot de passe" autocomplete="new-password" />` : ''}
      <button class="btn-auth-submit" id="auth-submit" onclick="submitAuth('${tab}')">
        ${isSignin ? 'Se connecter' : 'Créer mon compte'}
      </button>
      <p class="auth-switch">
        ${isSignin
          ? 'Pas de compte ? <span onclick="openAuthModal(\'signup\')">Créer un compte</span>'
          : 'Déjà un compte ? <span onclick="openAuthModal(\'signin\')">Se connecter</span>'}
      </p>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) closeAuthModal(); });
  modal.addEventListener('keydown', e => { if (e.key === 'Enter') submitAuth(tab); });
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('visible'));
  setTimeout(() => document.getElementById('auth-email')?.focus(), 50);
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) { modal.classList.remove('visible'); setTimeout(() => modal.remove(), 300); }
}

async function submitAuth(tab) {
  const emailEl    = document.getElementById('auth-email');
  const passwordEl = document.getElementById('auth-password');
  const errEl      = document.getElementById('auth-error');
  const btn        = document.getElementById('auth-submit');

  const email    = emailEl?.value.trim()  || '';
  const password = passwordEl?.value      || '';

  const password2El = document.getElementById('auth-password2');
  const password2   = password2El?.value || '';

  if (!email || !password) {
    _showAuthError(errEl, 'Remplis tous les champs.');
    return;
  }
  if (tab === 'signup' && password !== password2) {
    _showAuthError(errEl, 'Les mots de passe ne correspondent pas.');
    return;
  }

  btn.disabled = true;
  btn.textContent = '…';
  errEl.style.display = 'none';

  const { user, error } = tab === 'signin'
    ? await authSignIn(email, password)
    : await authSignUp(email, password);

  if (error) {
    btn.disabled = false;
    btn.textContent = tab === 'signin' ? 'Se connecter' : 'Créer mon compte';
    _showAuthError(errEl, _translateAuthError(error.message));
    return;
  }

  // Inscription : email de confirmation requis
  if (tab === 'signup' && user && !user.email_confirmed_at) {
    errEl.style.color = 'var(--green)';
    errEl.textContent = 'Vérifie ton email pour confirmer ton compte.';
    errEl.style.display = 'block';
    btn.textContent = 'Email envoyé !';
    return;
  }

  closeAuthModal();
  if (typeof showStatus === 'function') showStatus('success', 'Connecté !');
}

function _showAuthError(el, msg) {
  el.style.color = '';
  el.textContent = msg;
  el.style.display = 'block';
}

function _translateAuthError(msg) {
  if (!msg) return 'Erreur inconnue.';
  if (msg.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (msg.includes('Email not confirmed'))       return 'Confirme ton email avant de te connecter.';
  if (msg.includes('already registered'))        return 'Cet email est déjà utilisé.';
  if (msg.includes('User already registered'))   return 'Cet email est déjà utilisé.';
  if (msg.includes('Password should be'))        return 'Mot de passe trop court (6 caractères min.).';
  if (msg.includes('rate limit'))                return 'Trop de tentatives, réessaie dans quelques minutes.';
  return msg;
}
