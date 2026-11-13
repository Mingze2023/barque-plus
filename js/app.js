// ============================================================
// Barque+ front-end script: layout, sections, and startup.
// Accounts live in js/account.js.
// ============================================================
import { loadFirebase } from './firebase.js';
import { setupAccounts, saveAvatar } from './account.js';
import { newsSection } from './news.js';
import { eventsSection } from './events.js';
import { closeModal } from './modal.js';

// ---------- Sections ----------
// Every section of the site is one entry here.
// To add a new section later, add one object to this list.
// Every section of the site is one entry here. Each section lives in its own
// file in js/ and has: id, label, icon, mount(el, param, ctx), and optionally reset().
// To add a new section later, import it above and add it to this list.
const SECTIONS = [
  newsSection,
  eventsSection,
];

const DEFAULT_SECTION = 'news';

// ---------- Small helper: remember things in this browser ----------
function save(key, value) {
  try { localStorage.setItem('barque.' + key, value); } catch (e) { /* storage unavailable */ }
}
function load(key, fallback) {
  try { return localStorage.getItem('barque.' + key) ?? fallback; } catch (e) { return fallback; }
}

// ---------- Build the left menu ----------
function buildNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = SECTIONS.map(s => `
    <a class="nav-link" href="#${s.id}" data-id="${s.id}" title="${s.label}">
      <svg viewBox="0 0 24 24">${s.icon}</svg>
      <span class="fade-label">${s.label}</span>
    </a>
  `).join('');
}

// ---------- Show the section named in the address bar ----------
// The address looks like #news, or #news/<article-id> for one article.
let ctx = null;            // { fb, profile } while logged in
let leaveSection = null;   // cleanup for the section currently shown

function showSection() {
  const [id, ...rest] = (location.hash.slice(1) || DEFAULT_SECTION).split('/');
  const param = rest.length ? decodeURIComponent(rest.join('/')) : null;
  const section = SECTIONS.find(s => s.id === id) || SECTIONS[0];

  if (leaveSection) { leaveSection(); leaveSection = null; }
  const page = document.getElementById('page');
  page.innerHTML = '';
  leaveSection = section.mount(page, param, ctx) || null;

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.id === section.id);
  });
  document.title = section.label + ' · Barque+';
}

// ---------- Collapsible sidebars ----------
function setupSidebar(sidebarId, buttonId, storageKey, openLabel, closeLabel) {
  const sidebar = document.getElementById(sidebarId);
  const button = document.getElementById(buttonId);

  function apply(collapsed) {
    sidebar.classList.toggle('collapsed', collapsed);
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', collapsed ? openLabel : closeLabel);
  }

  apply(load(storageKey, 'open') === 'closed');

  button.addEventListener('click', () => {
    const collapsed = !sidebar.classList.contains('collapsed');
    apply(collapsed);
    save(storageKey, collapsed ? 'closed' : 'open');
  });
}

// ---------- Profile icon (2 states) ----------
const AVATARS = {
  male: `
    <svg viewBox="0 0 100 100">
      <circle cx="50" cy="38" r="17" fill="#7a5230"/>
      <path d="M18 92c2-18 15-28 32-28s30 10 32 28z" fill="#7a5230"/>
    </svg>`,
  female: `
    <svg viewBox="0 0 100 100">
      <path d="M28 44c0-17 9-27 22-27s22 10 22 27v16c0 4-3 6-6 6H34c-3 0-6-2-6-6z" fill="#3a2414"/>
      <circle cx="50" cy="40" r="15" fill="#7a5230"/>
      <path d="M18 92c2-18 15-28 32-28s30 10 32 28z" fill="#7a5230"/>
    </svg>`,
};

let avatarChoice = 'male';

function drawAvatar() {
  document.getElementById('avatarBtn').innerHTML = AVATARS[avatarChoice] || AVATARS.male;
}

function setupAvatar() {
  document.getElementById('avatarBtn').addEventListener('click', () => {
    avatarChoice = avatarChoice === 'male' ? 'female' : 'male';
    drawAvatar();             // change right away
    saveAvatar(avatarChoice); // then save it to the account
  });
}

// ---------- Logged in / logged out ----------
let loggedIn = false;

let firebase = null;

function showLoggedIn(profile) {
  loggedIn = true;
  ctx = { fb: firebase, profile };
  document.body.classList.remove('checking', 'logged-out');
  document.body.classList.add('logged-in');
  document.getElementById('profileName').textContent = profile.username;
  document.getElementById('profileType').textContent = profile.profileType;
  avatarChoice = profile.avatar === 'female' ? 'female' : 'male';
  drawAvatar();
  showSection();
}

function showLoggedOut() {
  loggedIn = false;
  if (leaveSection) { leaveSection(); leaveSection = null; }
  SECTIONS.forEach(s => s.reset && s.reset());
  closeModal();
  ctx = null;
  document.body.classList.remove('checking', 'logged-in');
  document.body.classList.add('logged-out');
  document.getElementById('page').innerHTML = '';
  document.title = 'Barque+';
}

// ---------- Date in the masthead ----------
function showDate() {
  document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ---------- Start ----------
async function start() {
  buildNav();
  showDate();
  setupAvatar();
  setupSidebar('leftSidebar', 'leftToggle', 'leftSidebar', 'Expand menu', 'Collapse menu');
  setupSidebar('rightSidebar', 'rightToggle', 'rightSidebar', 'Expand profile', 'Collapse profile');
  window.addEventListener('hashchange', () => { if (loggedIn) showSection(); });

  try {
    firebase = await loadFirebase();
  } catch (e) {
    showLoggedOut();
    document.getElementById('authChooser').hidden = true;
    document.getElementById('startupError').textContent = e.stage === 'config'
      ? 'Firebase settings are missing in js/firebase-config.js.'
      : 'Could not reach Firebase. The network may be blocking www.gstatic.com.';
    return;
  }

  setupAccounts(firebase, { onLogin: showLoggedIn, onLogout: showLoggedOut });
}

start();
