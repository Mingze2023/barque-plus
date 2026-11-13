// ============================================================
// Accounts (Step 3): Log In, Create Account, Forgot Password,
// email verification, and the user's profile in Firestore.
//
// Logins are handled by Firebase Authentication. Each user's
// profile (username, Profile Type, icon) is saved in Firestore
// at  users/{their id}.
// ============================================================

// ===== TESTING SWITCH =====
// true  = new accounts must click the link in their email before getting in
// false = skip email verification (for building/testing while school email
//         blocks the verification emails)
// If you change this, also change verificationRequired() in firestore.rules
// to match, and publish the rules again.
const REQUIRE_EMAIL_VERIFICATION = false;
// ==========================

const SCHOOL_DOMAIN = '@bsd405.org';
const MIN_PASSWORD_LENGTH = 6;   // Firebase doesn't allow shorter passwords
const RESEND_WAIT_SECONDS = 60;  // wait between "Resend link" clicks

let fb = null;          // { db, auth, firestore, authApi } from firebase.js
let callbacks = null;   // { onLogin(profile), onLogout() }
let profileRef = null;  // where the logged-in user's profile is saved
let mode = null;        // 'login' | 'register' | 'forgot'
let lastResend = 0;

const $ = (id) => document.getElementById(id);

// ---------- Small helpers ----------
function isSchoolEmail(email) {
  return /^[a-z0-9._%+-]+@bsd405\.org$/i.test(email);
}

function usernameFrom(email) {
  return email.slice(0, email.indexOf('@')).toLowerCase();
}

// Turns Firebase's error codes into plain messages
function messageFor(error) {
  const code = (error && error.code) || '';
  const messages = {
    'auth/email-already-in-use': 'an account with this email already exists',
    'auth/invalid-email': `Use your school email (ending in ${SCHOOL_DOMAIN}).`,
    'auth/weak-password': `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/user-not-found': 'Incorrect email or password.',
    'auth/user-disabled': 'This account has been turned off.',
    'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
    'auth/network-request-failed': 'Could not reach Firebase. Check your internet connection.',
    'permission-denied': 'Firebase refused to save your profile. Publish the Step 3 security rules.',
  };
  return messages[code] || (error && error.message) || 'Something went wrong.';
}

// ---------- Which panel shows in the right sidebar ----------
function showPanel(which) {
  $('authChooser').hidden = which !== 'chooser';
  $('verifyPanel').hidden = which !== 'verify';
}

// ---------- Log In / Create Account / Forgot Password form ----------
const MODES = {
  login:    { heading: 'Log In',         button: 'Log In',               password: true,  confirm: false, passwordLabel: 'Password' },
  register: { heading: 'Create Account', button: 'Create Account',       password: true,  confirm: true,  passwordLabel: `Password (at least ${MIN_PASSWORD_LENGTH} characters)` },
  forgot:   { heading: 'Reset Password', button: 'Email Me a Reset Link', password: false, confirm: false, passwordLabel: 'Password' },
};

function setMode(newMode) {
  mode = newMode;
  const m = MODES[mode];

  $('authForm').hidden = false;
  $('authHeading').textContent = m.heading;
  $('authSubmit').textContent = m.button;
  $('passwordLabel').textContent = m.passwordLabel;
  $('passwordField').hidden = !m.password;
  $('confirmField').hidden = !m.confirm;
  $('authPassword').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
  $('authPassword').value = '';
  $('authConfirm').value = '';
  $('authError').textContent = '';
  $('authSuccess').textContent = '';
  $('forgotBtn').hidden = mode === 'register';
  $('forgotBtn').textContent = mode === 'login' ? 'Forgot password?' : 'Back to Log In';

  // Highlight the matching tab ("Reset Password" counts as part of Log In)
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.mode === (mode === 'forgot' ? 'login' : mode));
  });

  updateUsernamePreview();
  $('authEmail').focus();
}

// While creating an account, show what the username will be
function updateUsernamePreview() {
  const email = $('authEmail').value.trim();
  const at = email.indexOf('@');
  $('usernamePreview').textContent = (mode === 'register' && at > 0)
    ? 'Your username will be: ' + usernameFrom(email)
    : '';
}

async function submitForm(event) {
  event.preventDefault();
  const { authApi, auth } = fb;
  const email = $('authEmail').value.trim();
  const password = $('authPassword').value;
  const confirm = $('authConfirm').value;
  const error = $('authError');
  error.textContent = '';
  $('authSuccess').textContent = '';

  // Checks before asking Firebase
  if (!email) { error.textContent = 'Please type your email.'; return; }
  if (!isSchoolEmail(email)) { error.textContent = `Use your school email (ending in ${SCHOOL_DOMAIN}).`; return; }
  if (MODES[mode].password && !password) { error.textContent = 'Please type your password.'; return; }
  if (mode === 'register') {
    if (password.length < MIN_PASSWORD_LENGTH) { error.textContent = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`; return; }
    if (password !== confirm) { error.textContent = 'Passwords do not match.'; return; }
  }

  $('authSubmit').disabled = true;
  try {
    if (mode === 'register') {
      const result = await authApi.createUserWithEmailAndPassword(auth, email, password);
      if (REQUIRE_EMAIL_VERIFICATION) {
        await authApi.sendEmailVerification(result.user);
        lastResend = Date.now();
        // The "Check your email" panel appears automatically (see watchLogin)
      }
    } else if (mode === 'login') {
      await authApi.signInWithEmailAndPassword(auth, email, password);
    } else {
      await authApi.sendPasswordResetEmail(auth, email);
      $('authSuccess').textContent =
        'If an account exists for that email, we sent it a link to reset your password. Check your inbox and junk folder.';
    }
  } catch (e) {
    error.textContent = messageFor(e);
  }
  $('authSubmit').disabled = false;
}

// ---------- Waiting for the email verification link ----------
function showVerify(user) {
  showPanel('verify');
  $('verifyNote').textContent =
    `We sent a link to ${user.email}. Click it to confirm this is your email, then come back here. ` +
    `Check your junk folder if you don't see it.`;
  $('verifyError').textContent = '';
  $('verifySuccess').textContent = '';
}

async function checkVerified() {
  const user = fb.auth.currentUser;
  if (!user) return;
  $('verifyError').textContent = '';
  $('verifyDoneBtn').disabled = true;
  try {
    await user.reload();                 // ask Firebase for the latest status
    if (user.emailVerified) {
      await user.getIdToken(true);       // so the database knows too
      await enterSite(user);
    } else {
      $('verifyError').textContent = "Not verified yet. Click the link in the email first.";
    }
  } catch (e) {
    $('verifyError').textContent = messageFor(e);
  }
  $('verifyDoneBtn').disabled = false;
}

async function resendLink() {
  const user = fb.auth.currentUser;
  if (!user) return;
  $('verifyError').textContent = '';
  $('verifySuccess').textContent = '';

  const wait = Math.ceil((lastResend + RESEND_WAIT_SECONDS * 1000 - Date.now()) / 1000);
  if (wait > 0) { $('verifyError').textContent = `Please wait ${wait} seconds before sending another link.`; return; }

  try {
    await fb.authApi.sendEmailVerification(user);
    lastResend = Date.now();
    $('verifySuccess').textContent = 'Sent a new link. Use the newest email.';
  } catch (e) {
    $('verifyError').textContent = messageFor(e);
  }
}

// ---------- The user's profile in Firestore ----------
async function enterSite(user) {
  const { db, firestore } = fb;
  profileRef = firestore.doc(db, 'users', user.uid);

  try {
    const snap = await firestore.getDoc(profileRef);
    let profile;
    if (snap.exists()) {
      profile = snap.data();
      delete profile.lastSeen; // only needed below; not saved back
    } else {
      // First time this account gets in: create its profile
      profile = {
        username: usernameFrom(user.email),
        email: user.email.toLowerCase(),
        profileType: 'Student',
        avatar: 'male',
        createdAt: firestore.serverTimestamp(),
      };
      await firestore.setDoc(profileRef, profile);
    }

    // When was this account last on the site? (powers the "New" label on articles)
    const lastSeen = snap.exists() && snap.data().lastSeen ? snap.data().lastSeen.toDate() : null;
    rememberVisit();

    callbacks.onLogin({ ...profile, uid: user.uid, newSince: lastSeen });
  } catch (e) {
    showPanel('chooser');
    $('startupError').textContent = messageFor(e);
    callbacks.onLogout();
  }
}

// Saves "this account was on the site now". Called when entering the site
// and when the page is closed or hidden.
let visitTrackingStarted = false;
function rememberVisit() {
  if (profileRef) {
    fb.firestore.updateDoc(profileRef, { lastSeen: fb.firestore.serverTimestamp() })
      .catch((e) => console.error('Could not save last visit:', e));
  }
  if (!visitTrackingStarted) {
    visitTrackingStarted = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') rememberVisit();
    });
  }
}

// Saves the profile icon choice ('male' or 'female') to the account
export async function saveAvatar(choice) {
  if (!profileRef) return;
  try {
    await fb.firestore.updateDoc(profileRef, { avatar: choice });
  } catch (e) {
    console.error('Could not save icon:', e);
  }
}

// ---------- Reacting to logging in and out ----------
function watchLogin() {
  fb.authApi.onAuthStateChanged(fb.auth, async (user) => {
    $('startupError').textContent = '';

    if (!user) {
      profileRef = null;
      $('authForm').reset();
      $('authForm').hidden = true;
      document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.remove('active'));
      showPanel('chooser');
      callbacks.onLogout();
      return;
    }

    // Accounts can only be made through our form, but just in case:
    if (!isSchoolEmail(user.email || '')) {
      await fb.authApi.signOut(fb.auth);
      $('startupError').textContent = `Only ${SCHOOL_DOMAIN} accounts can use Barque+.`;
      return;
    }

    if (REQUIRE_EMAIL_VERIFICATION && !user.emailVerified) {
      callbacks.onLogout();
      showVerify(user);
      return;
    }

    await enterSite(user);
  });
}

// ---------- Start ----------
// firebase:  what loadFirebase() returned
// handlers:  { onLogin(profile), onLogout() }
export function setupAccounts(firebase, handlers) {
  fb = firebase;
  callbacks = handlers;

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
  });
  $('forgotBtn').addEventListener('click', () => setMode(mode === 'login' ? 'forgot' : 'login'));
  $('authEmail').addEventListener('input', updateUsernamePreview);
  $('authForm').addEventListener('submit', submitForm);

  $('verifyDoneBtn').addEventListener('click', checkVerified);
  $('verifyResendBtn').addEventListener('click', resendLink);
  $('verifyLogoutBtn').addEventListener('click', () => fb.authApi.signOut(fb.auth));
  $('logoutBtn').addEventListener('click', () => fb.authApi.signOut(fb.auth));

  watchLogin();
}
