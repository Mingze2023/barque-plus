// ============================================================
// Barque+ front-end script
// ============================================================

// ---------- Sections ----------
// Every section of the site is one entry here.
// To add a new section later, add one object to this list.
const SECTIONS = [
  {
    id: 'news',
    label: 'News',
    // Newspaper icon
    icon: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M7 9h7M7 12h7M7 15h4"/>',
    render: () => `
      <h2 class="page-title">News</h2>
      <div class="placeholder">Articles will appear here (Step 4).</div>
    `,
  },
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

// ---------- Show the section named in the address bar (#news etc.) ----------
function showSection() {
  const id = location.hash.slice(1) || DEFAULT_SECTION;
  const section = SECTIONS.find(s => s.id === id) || SECTIONS[0];

  document.getElementById('page').innerHTML = section.render();
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

function setupAvatar() {
  const btn = document.getElementById('avatarBtn');
  let current = load('avatar', 'male');

  function draw() {
    btn.innerHTML = AVATARS[current];
  }
  draw();

  btn.addEventListener('click', () => {
    current = current === 'male' ? 'female' : 'male';
    save('avatar', current);
    draw();
  });
}

// ---------- Date in the masthead ----------
function showDate() {
  document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ---------- Start ----------
buildNav();
showSection();
showDate();
setupAvatar();
setupSidebar('leftSidebar', 'leftToggle', 'leftSidebar', 'Expand menu', 'Collapse menu');
setupSidebar('rightSidebar', 'rightToggle', 'rightSidebar', 'Expand profile', 'Collapse profile');
window.addEventListener('hashchange', showSection);
