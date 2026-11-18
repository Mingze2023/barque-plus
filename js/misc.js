// ============================================================
// Miscellaneous section (Step 9)
//
// 1. Lunch and breakfast menus (below the map): two month calendars, with arrows to switch
//    months and today highlighted. The menus come from data/menus.json,
//    which the daily GitHub Action collects from Health-e Pro
//    (scripts/scrape_menus.py).
// 3. Bell schedules (below the menus): Monday/Tuesday/Friday, Wednesday and
//    Thursday, from data/bells.json (collected daily by
//    scripts/scrape_bells.py) or the built-in copy in js/bell-list.js.
//    Today's schedule is marked, and the period happening right now (by
//    this computer's clock) gets a highlighted outline.
// 2. A map of the school (at the very top), saved in Firestore like Student Art pictures:
//      siteImages/map  { data }
//    Shown at the top of the page. Blank placeholder until one is uploaded. In Editor Mode, click the map
//    (or the placeholder) to upload a different picture.
// ============================================================
import { esc } from './util.js';
import { openModal } from './modal.js';
import { showToast } from './toast.js';
import { shrinkImage } from './images.js';
import { BELL_SCHEDULES, BELL_PAGE, BELL_NOTE } from './bell-list.js';

const ICON_MISC = '<circle cx="12" cy="12" r="9"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MENU_ORDER = ['lunch', 'breakfast'];
const UNDO_SECONDS = 10;

// ---------- Dates (all in the computer's own time, i.e. Bellevue) ----------
const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

// ---------- The menu data (downloaded once per visit) ----------
let menusPromise = null;
function loadMenus() {
  if (!menusPromise) {
    menusPromise = fetch(`data/menus.json?v=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return menusPromise;
}

// ---------- One month calendar ----------
function dayHTML(info) {
  if (!info) return '';
  if (info.off) return `<div class="menu-off">${esc(info.off)}</div>`;
  const notes = (info.notes || []).map((n) => `<div class="menu-note">${esc(n)}</div>`).join('');
  const sections = (info.sections || []).map((s) => `
    <div class="menu-group">
      ${s.title ? `<div class="menu-group-title">${esc(s.title)}</div>` : ''}
      ${s.items.map((i) => `<div class="menu-item">${esc(i)}</div>`).join('')}
    </div>`).join('');
  return sections + notes;
}

function calendarHTML(menu, key, monthKey, today) {
  const [y, m] = monthKey.split('-').map(Number);
  const days = (menu && menu.months && menu.months[monthKey]) || null;
  const title = menu ? menu.title : (key === 'lunch' ? 'Lunch' : 'Breakfast');
  const first = new Date(y, m - 1, 1);
  const count = new Date(y, m, 0).getDate();

  let cells = '';
  for (let i = 0; i < first.getDay(); i++) cells += '<div class="menu-cell empty"></div>';
  for (let d = 1; d <= count; d++) {
    const date = new Date(y, m - 1, d);
    const k = dayKey(date);
    const info = days ? days[k] : null;
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const classes = ['menu-cell', weekend ? 'weekend' : '', k === today ? 'today' : '', info && info.off ? 'off' : '', k < today ? 'past' : ''].filter(Boolean).join(' ');
    cells += `
      <div class="${classes}">
        <div class="menu-date"><span>${d}</span>${k === today ? '<em>Today</em>' : ''}</div>
        ${info && !info.off ? `<div class="menu-day-body">${dayHTML(info)}</div>` : dayHTML(info)}
      </div>`;
  }
  const trailing = (7 - ((first.getDay() + count) % 7)) % 7;
  for (let i = 0; i < trailing; i++) cells += '<div class="menu-cell empty"></div>';

  return `
    <section class="menu-calendar menu-${key}">
      <div class="menu-calendar-head">
        <h3>${esc(title)}</h3>
        ${menu && menu.page ? `<a href="${esc(menu.page)}" target="_blank" rel="noopener">Open on Health-e Pro ↗</a>` : ''}
      </div>
      ${days ? '' : `<p class="menu-none">No ${esc(title.toLowerCase())} menu has been published for ${esc(monthLabel(monthKey))}.</p>`}
      <div class="menu-grid">
        ${WEEKDAYS.map((w, i) => `<div class="menu-weekday${i === 0 || i === 6 ? ' weekend' : ''}">${w}</div>`).join('')}
        ${cells}
      </div>
    </section>`;
}

// Days with more than 10 lines fade out at the bottom; click one to see it all
// (click again to shrink it back).
function markLongDays(box) {
  box.querySelectorAll('.menu-day-body').forEach((body) => {
    if (body.scrollHeight <= body.clientHeight + 1) return;
    const cell = body.closest('.menu-cell');
    cell.classList.add('long');
    cell.tabIndex = 0;
    cell.setAttribute('role', 'button');
    cell.setAttribute('aria-expanded', 'false');
    cell.title = 'Click to see the whole menu';
    const toggle = () => {
      const open = cell.classList.toggle('expanded');
      cell.setAttribute('aria-expanded', String(open));
      cell.title = open ? 'Click to shrink' : 'Click to see the whole menu';
    };
    cell.addEventListener('click', toggle);
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });
}

function mountMenus(box) {
  box.innerHTML = '<div class="placeholder">Loading the menus…</div>';
  let alive = true;

  loadMenus().then((data) => {
    if (!alive) return;
    const menus = data && data.menus;
    const months = menus ? [...new Set(MENU_ORDER.flatMap((k) => Object.keys((menus[k] && menus[k].months) || {})))].sort() : [];
    if (!months.length) {
      box.innerHTML = `<div class="placeholder menu-missing">The lunch and breakfast menus haven't been collected yet.
        They're updated every morning (an editor can also run it now: GitHub → Actions → Scrape news and publish site → Run workflow).</div>`;
      return;
    }

    const now = new Date();
    const today = dayKey(now);
    const thisMonth = monthKeyOf(now);
    // Start on this month, or the closest month that has menus
    let index = months.indexOf(thisMonth);
    if (index < 0) {
      const later = months.findIndex((mk) => mk > thisMonth);
      index = later >= 0 ? later : months.length - 1;
    }

    function draw() {
      const monthKey = months[index];
      box.innerHTML = `
        <div class="menu-switcher">
          <button class="menu-arrow" id="menuPrev" aria-label="Previous month" ${index === 0 ? 'disabled' : ''}>‹</button>
          <h2 class="menu-month">${esc(monthLabel(monthKey))}</h2>
          <button class="menu-arrow" id="menuNext" aria-label="Next month" ${index === months.length - 1 ? 'disabled' : ''}>›</button>
          ${monthKey !== thisMonth && months.includes(thisMonth) ? '<button class="link-btn menu-today" id="menuToday">Back to this month</button>' : ''}
        </div>
        ${MENU_ORDER.map((k) => calendarHTML(menus[k], k, monthKey, today)).join('')}`;
      markLongDays(box);
      box.querySelector('#menuPrev').addEventListener('click', () => { index -= 1; draw(); });
      box.querySelector('#menuNext').addEventListener('click', () => { index += 1; draw(); });
      const back = box.querySelector('#menuToday');
      if (back) back.addEventListener('click', () => { index = months.indexOf(thisMonth); draw(); });
    }
    draw();
  });

  return () => { alive = false; };
}

// ---------- Bell schedules ----------
let bellsPromise = null;
function loadBells() {
  if (!bellsPromise) {
    bellsPromise = fetch(`data/bells.json?v=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d && Array.isArray(d.schedules) && d.schedules.length ? d.schedules : BELL_SCHEDULES))
      .catch(() => BELL_SCHEDULES);
  }
  return bellsPromise;
}

// "1:15" -> minutes after midnight. The school writes times without a.m./p.m.:
// 7-11 are morning, 12 is noon, 1-6 are afternoon.
function minutesOf(time) {
  const [h, m] = String(time).split(':').map(Number);
  return (h < 7 ? h + 12 : h) * 60 + m;
}
function clockText(time) {
  const [h, m] = String(time).split(':').map(Number);
  return `${h}:${String(m).padStart(2, '0')}`;
}

function mountBells(box) {
  box.innerHTML = '<div class="placeholder">Loading the bell schedules…</div>';
  let alive = true;
  let timer = null;

  loadBells().then((schedules) => {
    if (!alive) return;
    function draw() {
      const now = new Date();
      const weekday = now.getDay();            // 0 = Sunday ... 6 = Saturday
      const minute = now.getHours() * 60 + now.getMinutes();
      const nowParts = [];
      const cards = schedules.map((sched, si) => {
        const today = (sched.days || []).includes(weekday);
        const rows = sched.periods.map(([name, start, end]) => {
          const current = today && minute >= minutesOf(start) && minute < minutesOf(end);
          if (current) nowParts.push(`${name} (until ${clockText(end)})`);
          return `
            <div class="bell-row${current ? ' now' : ''}">
              <span class="bell-period">${esc(name)}</span>
              <span class="bell-time">${esc(clockText(start))} – ${esc(clockText(end))}</span>
              ${current ? '<span class="bell-now-tag">Now</span>' : ''}
            </div>`;
        }).join('');
        return `
          <section class="bell-card${today ? ' today' : ''}" data-schedule="${si}">
            <h3>${esc(sched.name)}${today ? '<em>Today</em>' : ''}</h3>
            <div class="bell-head"><span>Period</span><span>Time</span></div>
            ${rows}
          </section>`;
      }).join('');
      box.innerHTML = `
        <div class="bells-head">
          <h2 class="misc-heading">Bell Schedules</h2>
          <a href="${BELL_PAGE}" target="_blank" rel="noopener">School website ↗</a>
        </div>
        <p class="bells-now" role="status">${nowParts.length ? `Right now: <strong>${esc(nowParts.join(' · '))}</strong>` : ''}</p>
        <div class="bell-grid">${cards}</div>
        <p class="bells-note">${esc(BELL_NOTE)}</p>`;
    }
    draw();
    // Check the clock again every 15 seconds (only redraw when the minute changes)
    let last = new Date().getMinutes();
    timer = setInterval(() => {
      const m = new Date().getMinutes();
      if (m !== last) { last = m; draw(); }
    }, 15000);
  });

  return () => { alive = false; if (timer) clearInterval(timer); };
}

// ---------- The school map ----------
let mapCache;   // undefined = not loaded yet, null = no map, string = picture

function mountMap(box, ctx) {
  const { db, firestore } = ctx.fb;
  const mapRef = firestore.doc(db, 'siteImages', 'map');
  const editing = ctx.editorMode;
  let alive = true;

  function draw(note = '') {
    if (!alive) return;
    const picture = mapCache;
    box.innerHTML = `
      <div class="map-head">
        <h2 class="misc-heading">School Map</h2>
        ${editing && picture ? '<span class="map-hint">Click the map to replace it.</span>' : ''}
      </div>
      <button type="button" class="map-frame${picture ? '' : ' empty'}${editing ? ' editable' : ''}" id="mapFrame"
        aria-label="${editing ? 'Upload a map picture' : picture ? 'View the map larger' : 'No map yet'}" ${!editing && !picture ? 'disabled' : ''}>
        ${picture ? `<img src="${picture}" alt="Map of Bellevue High School">` : `
          <span class="map-placeholder">
            <svg viewBox="0 0 24 24"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>
            <span>${editing ? 'No map yet. Click here to upload one.' : 'A map of the school will appear here.'}</span>
          </span>`}
        ${editing ? '<span class="map-edit-badge">Upload a map</span>' : ''}
      </button>
      <input type="file" id="mapFile" accept="image/jpeg,image/png,image/gif,image/webp" hidden>
      <p class="paste-preview" id="mapNote" role="status">${esc(note)}</p>`;

    const frame = box.querySelector('#mapFrame');
    const file = box.querySelector('#mapFile');
    frame.addEventListener('click', () => {
      if (editing) file.click();
      else if (mapCache) openModal({ title: 'School Map', html: `<img class="map-large" src="${mapCache}" alt="Map of Bellevue High School">` });
    });
    file.addEventListener('change', () => upload(file.files[0]));
  }

  async function upload(chosen) {
    if (!chosen) return;
    const note = box.querySelector('#mapNote');
    note.classList.remove('bad');
    note.textContent = 'Shrinking the picture…';
    let picture;
    try {
      picture = await shrinkImage(chosen, { maxSide: 2400 });
    } catch (e) {
      note.textContent = e.message;
      note.classList.add('bad');
      return;
    }
    note.textContent = 'Saving…';
    const before = mapCache;
    try {
      await firestore.setDoc(mapRef, { data: picture });
    } catch (e) {
      note.textContent = `Couldn't save the map (${e.code || e.message}).`;
      note.classList.add('bad');
      return;
    }
    mapCache = picture;
    draw();
    showToast(before ? 'Map replaced.' : 'Map added.', {
      action: 'Undo',
      seconds: UNDO_SECONDS,
      onAction: async () => {
        try {
          if (before) await firestore.setDoc(mapRef, { data: before });
          else await firestore.deleteDoc(mapRef);
          mapCache = before || null;
          draw();
        } catch (e) {
          showToast(`Couldn't undo (${e.code || e.message}).`);
        }
      },
    });
  }

  if (mapCache !== undefined) draw();
  else {
    box.innerHTML = '<h2 class="misc-heading">School Map</h2><div class="placeholder">Loading the map…</div>';
    firestore.getDoc(mapRef).then((snap) => {
      mapCache = snap.exists() ? snap.data().data : null;
      draw();
    }).catch((e) => {
      if (alive) box.innerHTML = `<h2 class="misc-heading">School Map</h2><p class="form-error">Couldn't load the map (${esc(e.code || e.message)}).</p>`;
    });
  }
  return () => { alive = false; };
}

// ---------- The section ----------
export const miscSection = {
  id: 'misc',
  label: 'Miscellaneous',
  icon: ICON_MISC,

  mount(el, param, ctx) {
    el.innerHTML = `
      <div class="misc-banner">
        <h2 class="misc-title">Miscellaneous</h2>
        <p>What's for lunch and breakfast, when the bell rings, and how to find your way around.</p>
      </div>
      <div class="school-map" id="schoolMap"></div>
      <div class="menus" id="menus"></div>
      <div class="bells" id="bells"></div>`;
    const stopMenus = mountMenus(el.querySelector('#menus'));
    const stopMap = mountMap(el.querySelector('#schoolMap'), ctx);
    const stopBells = mountBells(el.querySelector('#bells'));
    return () => { stopMenus(); stopMap(); stopBells(); };
  },

  // Forget everything when someone logs out
  reset() {
    menusPromise = null;
    bellsPromise = null;
    mapCache = undefined;
  },
};
