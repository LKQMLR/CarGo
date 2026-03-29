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
  _authUser = null;
  updateAuthUI();
  if (typeof applyPremium === 'function') applyPremium(false);
}

// ── Mettre à jour le bouton compte dans le header ──
function updateAuthUI() {
  const btn = document.getElementById('btn-account');
  if (!btn) return;
  if (_authUser) {
    const email = _authUser.email || '';
    const display = email.length > 22 ? email.slice(0, 19) + '…' : email;
    btn.textContent = display;
    btn.title = email;
    btn.classList.add('logged-in');
  } else {
    btn.textContent = 'Connexion';
    btn.title = '';
    btn.classList.remove('logged-in');
  }
}

// ── Ouvrir/fermer le menu compte ──
function openAccountMenu() {
  if (!_authUser) { openAuthModal('signin'); return; }

  const old = document.getElementById('account-menu');
  if (old) { old.remove(); return; }

  const btn = document.getElementById('btn-account');
  const rect = btn.getBoundingClientRect();

  const menu = document.createElement('div');
  menu.id = 'account-menu';
  menu.className = 'account-menu';
  menu.style.top  = (rect.bottom + 6) + 'px';
  menu.style.left = rect.left + 'px';
  menu.innerHTML = `
    <div class="account-menu-email">${_authUser.email}</div>
    <button class="account-menu-btn account-menu-logout"
      onclick="authSignOut();document.getElementById('account-menu')?.remove()">
      Se déconnecter
    </button>
  `;

  // Fermer si clic en dehors
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
    <div class="modal-box confirm-box auth-box">
      <div class="auth-tabs">
        <button class="auth-tab${isSignin ? ' active' : ''}" onclick="openAuthModal('signin')">Se connecter</button>
        <button class="auth-tab${!isSignin ? ' active' : ''}" onclick="openAuthModal('signup')">Créer un compte</button>
      </div>
      <div id="auth-error" class="auth-error" style="display:none;"></div>
      <input type="email"    id="auth-email"    placeholder="Adresse email"  autocomplete="email" />
      <input type="password" id="auth-password" placeholder="Mot de passe (6 car. min.)"
        autocomplete="${isSignin ? 'current-password' : 'new-password'}" />
      <button class="btn-primary" id="auth-submit" onclick="submitAuth('${tab}')">
        ${isSignin ? 'Se connecter' : 'Créer mon compte'}
      </button>
      <button class="btn-modal-cancel" onclick="closeAuthModal()">Annuler</button>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) closeAuthModal(); });
  // Soumettre avec Entrée
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

  if (!email || !password) {
    _showAuthError(errEl, 'Remplis tous les champs.');
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
