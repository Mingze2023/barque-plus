// ============================================================
// Club Information section (Step 8)
//
// A bulletin board of clubs: search, then click a club for its page
// (one picture plus its information and news). No votes, comments or views.
//
// Saved in Firestore:
//   clubs/{id}       { name, advisor, meetingDay, meetingTime, room,
//                      description, hasImage, createdAt, updatedAt }
//   clubImages/{id}  { data }   the club's picture, shrunk to fit (js/images.js)
//
// Editor Mode: "Add Clubs from School Website" (adds the school's club
// table, with each club's advisor, meeting day, time and room, in one go),
// "+ Add Club" (name only), a trash bin on each club
// (with Undo for 10 seconds), and "Edit Club" on a club's page to
// change its details, text and picture. Club Leaders get editing for their
// own club in Step 16.
// ============================================================
import { esc, formatDate, paragraphsHTML } from './util.js';
import { openModal, closeModal } from './modal.js';
import { showToast } from './toast.js';
import { shrinkImage, describeSize } from './images.js';
import { SCHOOL_CLUBS, SCHOOL_CLUBS_PAGE } from './club-list.js';

// The details shown under each club's name (all can be edited)
const DETAILS = [
  { key: 'advisor', label: 'Advisor' },
  { key: 'meetingDay', label: 'Meets' },
  { key: 'meetingTime', label: 'Time' },
  { key: 'room', label: 'Room' },
];

const ICON_CLUBS = '<path d="M4 4h16v12H4z"/><path d="M8 20h8M12 16v4"/><circle cx="9" cy="9" r="1.6"/><path d="M13 8h4M13 11h3"/>';
const ICON_TRASH = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';
const UNDO_SECONDS = 10;

// Each club gets its own pin/strip color (picked from its name, so it never changes)
const CLUB_COLORS = ['#d9480f', '#1f9e8f', '#7048e8', '#1c7ed6', '#e8590c', '#2b8a3e', '#c2255c', '#f08c00'];
function clubColor(name) {
  let n = 0;
  for (const ch of name) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return CLUB_COLORS[n % CLUB_COLORS.length];
}

function initials(name) {
  return name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

// ---------- Pictures (downloaded only when needed, then remembered) ----------
const pictureCache = new Map();

function pictureHTML(club, className) {
  if (club.hasImage && pictureCache.has(club.id)) {
    return `<img class="${className}" src="${pictureCache.get(club.id)}" alt="">`;
  }
  const fallback = `<div class="${className} club-initials" style="--club:${clubColor(club.name)}">${esc(initials(club.name))}</div>`;
  return club.hasImage ? `<div class="club-picture-slot" data-club-image="${esc(club.id)}">${fallback}</div>` : fallback;
}

function loadPictures(container, ctx, className) {
  const { db, firestore } = ctx.fb;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(async (entry) => {
      if (!entry.isIntersecting) return;
      const slot = entry.target;
      observer.unobserve(slot);
      try {
        const snap = await firestore.getDoc(firestore.doc(db, 'clubImages', slot.dataset.clubImage));
        if (!snap.exists()) return;   // keep the initials
        pictureCache.set(slot.dataset.clubImage, snap.data().data);
        const img = document.createElement('img');
        img.className = className;
        img.src = snap.data().data;
        img.alt = '';
        slot.replaceWith(img);
      } catch (e) {
        console.error('Club picture failed:', e);
      }
    });
  }, { rootMargin: '300px' });
  container.querySelectorAll('[data-club-image]').forEach((el) => observer.observe(el));
  return observer;
}

// ---------- The board of clubs ----------
function cardHTML(club, editing) {
  const preview = club.description.replace(/\s+/g, ' ').trim();
  return `
    <article class="club-card" style="--club:${clubColor(club.name)}">
      <span class="club-pin"></span>
      <a class="club-card-main" href="#clubs/${encodeURIComponent(club.id)}">
        <div class="club-thumb">${pictureHTML(club, 'club-thumb-img')}</div>
        <h3 class="club-name">${esc(club.name)}</h3>
        ${cardDetailsHTML(club)}
        <p class="club-preview">${preview ? esc(preview) : '<em>No information yet.</em>'}</p>
      </a>
      ${editing ? `<button class="trash-btn club-delete" data-delete="${esc(club.id)}" title="Delete ${esc(club.name)}" aria-label="Delete ${esc(club.name)}">${ICON_TRASH}</button>` : ''}
    </article>`;
}

function cardDetailsHTML(club) {
  const when = [club.meetingDay, club.meetingTime].filter(Boolean).join(', ');
  const parts = [when, club.room].filter(Boolean);
  if (!parts.length && !club.advisor) return '';
  return `<p class="club-card-details">${parts.length ? `<span>${esc(parts.join(' · '))}</span>` : ''}${club.advisor ? `<span>${esc(club.advisor)}</span>` : ''}</p>`;
}

function mountBoard(el, ctx) {
  el.innerHTML = `
    <div class="clubs-banner">
      <h2 class="clubs-title">Club Information</h2>
      <p>Find out what every club is about, and what it's up to.</p>
    </div>
    ${ctx.clubEditMode && ctx.profile.clubId ? `<p class="leader-hint">Edit Mode: open <a href="#clubs/${encodeURIComponent(ctx.profile.clubId)}">${esc(ctx.profile.clubName || 'your club')}</a> and click its picture or text to change it.</p>` : ''}
    <div class="section-head clubs-toolbar">
      <label class="news-search clubs-search">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
        <input type="search" id="clubSearch" placeholder="Search clubs">
      </label>
      ${ctx.editorMode ? `<div class="clubs-editor-buttons">
        <button class="btn-secondary" id="importClubsBtn">Add Clubs from School Website</button>
        <button class="btn-add" id="addClubBtn">+ Add Club</button>
      </div>` : ''}
    </div>
    <div class="clubs-board" id="clubsBoard"><div class="placeholder">Loading clubs…</div></div>
    <p class="form-error" id="clubsError" role="alert"></p>
  `;

  let clubs = [];
  let observer = null;
  const board = el.querySelector('#clubsBoard');
  const search = el.querySelector('#clubSearch');

  function draw() {
    if (observer) observer.disconnect();
    const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    const shown = clubs.filter((c) => words.every((w) => [c.name, c.description, ...DETAILS.map((d) => c[d.key])].join(' ').toLowerCase().includes(w)));

    if (!clubs.length) {
      board.innerHTML = `<div class="placeholder clubs-empty">No clubs have been added yet.${ctx.editorMode ? ' Click <strong>Add Clubs from School Website</strong> to add the whole school list at once, or <strong>+ Add Club</strong> to add one.' : ''}</div>`;
      return;
    }
    if (!shown.length) {
      board.innerHTML = `<div class="placeholder clubs-empty">No clubs match “${esc(search.value)}”.</div>`;
      return;
    }
    board.innerHTML = shown.map((c) => cardHTML(c, ctx.editorMode)).join('');
    board.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', () => {
      deleteClub(ctx, clubs.find((c) => c.id === b.dataset.delete));
    }));
    observer = loadPictures(board, ctx, 'club-thumb-img');
  }

  search.addEventListener('input', draw);
  if (ctx.editorMode) {
    el.querySelector('#addClubBtn').addEventListener('click', () => openAddClub(ctx, clubs));
    el.querySelector('#importClubsBtn').addEventListener('click', () => openImportClubs(ctx, clubs));
  }

  const { db, firestore } = ctx.fb;
  const stop = firestore.onSnapshot(firestore.collection(db, 'clubs'), (snapshot) => {
    clubs = snapshot.docs.map(fromDoc).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    draw();
  }, (error) => {
    board.innerHTML = '';
    el.querySelector('#clubsError').textContent = `Couldn't load clubs (${error.code || error.message}).`;
  });

  return () => { stop(); if (observer) observer.disconnect(); };
}

function fromDoc(doc) {
  const d = doc.data();
  return {
    id: doc.id,
    name: d.name || 'Unnamed club',
    advisor: d.advisor || '',
    meetingDay: d.meetingDay || '',
    meetingTime: d.meetingTime || '',
    room: d.room || '',
    description: d.description || '',
    hasImage: !!d.hasImage,
    createdAt: d.createdAt ? d.createdAt.toDate() : new Date(),
    updatedAt: d.updatedAt ? d.updatedAt.toDate() : null,
  };
}

// ---------- One club's page ----------
function pageDetailsHTML(club) {
  const shown = DETAILS.filter((d) => club[d.key]);
  if (!shown.length) return '';
  return `<dl class="club-details">${shown.map((d) => `<div><dt>${d.label}</dt><dd>${esc(club[d.key])}</dd></div>`).join('')}</dl>`;
}

function mountClub(el, clubId, ctx) {
  el.innerHTML = '<a class="back-link" href="#clubs">← All clubs</a><div class="placeholder">Loading…</div>';
  const { db, firestore } = ctx.fb;
  let observer = null;

  const stop = firestore.onSnapshot(firestore.doc(db, 'clubs', clubId), (snap) => {
    if (observer) observer.disconnect();
    if (!snap.exists()) {
      el.innerHTML = '<a class="back-link" href="#clubs">← All clubs</a><div class="placeholder">That club wasn\'t found. It may have been deleted.</div>';
      return;
    }
    const club = fromDoc({ id: snap.id, data: () => snap.data() });
    // A Club Leader in Edit Mode, on their own club's page
    const leading = ctx.clubEditMode && ctx.profile.clubId === club.id;
    el.innerHTML = `
      <a class="back-link" href="#clubs">← All clubs</a>
      <article class="club-page${leading ? ' leader-editing' : ''}" style="--club:${clubColor(club.name)}">
        ${leading ? '<p class="leader-hint">Edit Mode: click your club\'s picture or text to change it.</p>' : ''}
        <div class="club-page-picture${leading ? ' leader-editable' : ''}" ${leading ? 'id="leaderPicture" role="button" tabindex="0" title="Click to upload a picture"' : ''}>
          ${pictureHTML(club, 'club-page-img')}
          ${leading ? `<span class="leader-edit-badge">${club.hasImage ? 'Change picture' : 'Upload a picture'}</span>` : ''}
        </div>
        ${leading ? '<input type="file" id="leaderFile" accept="image/jpeg,image/png,image/gif,image/webp" hidden><p class="paste-preview" id="leaderNote" role="status"></p>' : ''}
        <div class="club-page-head">
          <h1 class="club-page-name">${esc(club.name)}</h1>
          ${ctx.editorMode ? '<button class="btn-add" id="editClubBtn">Edit Club</button>' : ''}
        </div>
        ${pageDetailsHTML(club)}
        ${club.updatedAt ? `<div class="club-updated">Updated ${esc(formatDate(club.updatedAt))}</div>` : ''}
        <div class="club-page-body${leading ? ' leader-editable' : ''}" ${leading ? 'id="leaderText" role="button" tabindex="0" title="Click to edit your club\'s text"' : ''}>
          ${paragraphsHTML(club.description) || `<p class="club-empty-text"><em>${leading ? 'Click here to add your club\'s information and news.' : 'This club hasn\'t added any information yet.'}</em></p>`}
          ${leading ? '<span class="leader-edit-badge">Edit text</span>' : ''}
        </div>
      </article>`;
    observer = loadPictures(el, ctx, 'club-page-img');
    if (ctx.editorMode) el.querySelector('#editClubBtn').addEventListener('click', () => openEditClub(ctx, club));
    if (leading) hookLeaderTools(el, ctx, club);
  }, (error) => {
    el.innerHTML = `<a class="back-link" href="#clubs">← All clubs</a><p class="form-error">Couldn't load this club (${esc(error.code || error.message)}).</p>`;
  });

  return () => { stop(); if (observer) observer.disconnect(); };
}

// ---------- Club Leader tools (Edit Mode, own club only) ----------
// The security rules only let a Club Leader change their own club's text and picture.
function hookLeaderTools(el, ctx, club) {
  const { db, firestore } = ctx.fb;
  const clubRef = firestore.doc(db, 'clubs', club.id);
  const onKey = (fn) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

  // Text: a large text box in a popup
  const openText = () => {
    const body = openModal({
      title: `Edit ${club.name}`,
      subtitle: 'Your club\'s information and news. Leave a blank line between paragraphs.',
      html: `
        <textarea class="paste-box leader-textbox" id="leaderTextBox" rows="16" maxlength="20000"></textarea>
        <p class="form-error" id="leaderTextError" role="alert"></p>
        <button class="btn-primary" id="leaderTextSave">Save</button>`,
    });
    const box = body.querySelector('#leaderTextBox');
    box.value = club.description;
    box.focus();
    body.querySelector('#leaderTextSave').addEventListener('click', async () => {
      const button = body.querySelector('#leaderTextSave');
      button.disabled = true;
      try {
        await firestore.updateDoc(clubRef, { description: box.value.trim(), updatedAt: firestore.serverTimestamp() });
        closeModal();
        showToast('Club information saved.');
      } catch (e) {
        body.querySelector('#leaderTextError').textContent = `Couldn't save it (${e.code || e.message}).`;
        button.disabled = false;
      }
    });
  };
  const text = el.querySelector('#leaderText');
  text.addEventListener('click', openText);
  text.addEventListener('keydown', onKey(openText));

  // Picture: pick a file, shrink it, save it (like Student Art)
  const file = el.querySelector('#leaderFile');
  const picture = el.querySelector('#leaderPicture');
  const note = el.querySelector('#leaderNote');
  picture.addEventListener('click', () => file.click());
  picture.addEventListener('keydown', onKey(() => file.click()));
  file.addEventListener('change', async () => {
    const chosen = file.files[0];
    if (!chosen) return;
    note.classList.remove('bad');
    note.textContent = 'Shrinking the picture…';
    let data;
    try {
      data = await shrinkImage(chosen);
    } catch (e) {
      note.textContent = e.message;
      note.classList.add('bad');
      return;
    }
    note.textContent = 'Saving…';
    try {
      const batch = firestore.writeBatch(db);
      batch.set(firestore.doc(db, 'clubImages', club.id), { data });
      batch.update(clubRef, { hasImage: true, updatedAt: firestore.serverTimestamp() });
      await batch.commit();
      pictureCache.set(club.id, data);
      showToast('Picture saved.');
    } catch (e) {
      note.textContent = `Couldn't save the picture (${e.code || e.message}).`;
      note.classList.add('bad');
    }
  });
}

// ---------- Editor tools ----------
function openAddClub(ctx, existingClubs) {
  const body = openModal({
    title: 'Add a club',
    html: `
      <p class="modal-hint">Just the name for now. Open the club afterward and click <strong>Edit Club</strong> to add its information and picture.</p>
      <label class="field modal-field"><span>Club name</span><input type="text" id="clubName" maxlength="100" autocomplete="off"></label>
      <p class="form-error" id="clubError" role="alert"></p>
      <button class="btn-primary" id="clubSave">Add Club</button>`,
  });
  const nameBox = body.querySelector('#clubName');
  const error = body.querySelector('#clubError');
  nameBox.focus();
  nameBox.addEventListener('input', () => { error.textContent = ''; });
  nameBox.addEventListener('keydown', (e) => { if (e.key === 'Enter') body.querySelector('#clubSave').click(); });

  body.querySelector('#clubSave').addEventListener('click', async () => {
    const name = nameBox.value.trim().replace(/\s+/g, ' ');
    if (!name) { error.textContent = 'Type the club\'s name.'; return; }
    if (existingClubs.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      error.textContent = `There's already a club called "${name}".`;
      return;
    }
    const { db, firestore } = ctx.fb;
    body.querySelector('#clubSave').disabled = true;
    try {
      await firestore.addDoc(firestore.collection(db, 'clubs'), {
        name, description: '', hasImage: false, createdAt: firestore.serverTimestamp(),
      });
      closeModal();
      showToast(`Added "${name}".`);
    } catch (e) {
      error.textContent = `Couldn't add the club (${e.code || e.message}).`;
      body.querySelector('#clubSave').disabled = false;
    }
  });
}

function openEditClub(ctx, club) {
  const current = pictureCache.get(club.id) || null;
  const body = openModal({
    title: `Edit ${club.name}`,
    html: `
      <p class="settings-label">Picture</p>
      <div class="club-edit-picture">
        <img class="art-upload-preview" id="clubPreview" alt="" ${current ? `src="${current}"` : 'hidden'}>
        <p class="paste-preview" id="clubPictureNote">${club.hasImage ? (current ? 'Current picture.' : 'This club has a picture.') : 'No picture yet.'}</p>
        <label class="field modal-field"><span>${club.hasImage ? 'Replace it with' : 'Add a picture'} (JPG, PNG, GIF or WebP)</span>
          <input type="file" id="clubFile" accept="image/jpeg,image/png,image/gif,image/webp"></label>
        ${club.hasImage ? '<button type="button" class="link-btn" id="clubRemovePicture">Remove the picture</button>' : ''}
      </div>
      <div class="club-detail-fields">
        ${DETAILS.map((d) => `<label class="field modal-field"><span>${d.key === 'meetingDay' ? 'Meeting day' : d.label}</span>
          <input type="text" id="club-${d.key}" maxlength="200" autocomplete="off"></label>`).join('')}
      </div>
      <label class="field modal-field"><span>Information and news (leave a blank line between paragraphs)</span>
        <textarea class="paste-box" id="clubText" rows="10" maxlength="20000"></textarea></label>
      <p class="form-error" id="clubError" role="alert"></p>
      <button class="btn-primary" id="clubSave">Save Changes</button>`,
  });
  const $ = (sel) => body.querySelector(sel);
  $('#clubText').value = club.description;
  DETAILS.forEach((d) => { $(`#club-${d.key}`).value = club[d.key]; });
  $('#clubText').focus();

  let newPicture = null;     // a new picture to save
  let removePicture = false; // remove the current one

  $('#clubFile').addEventListener('change', async () => {
    const file = $('#clubFile').files[0];
    const note = $('#clubPictureNote');
    newPicture = null;
    note.classList.remove('bad');
    if (!file) return;
    note.textContent = 'Shrinking the picture…';
    try {
      newPicture = await shrinkImage(file);
      removePicture = false;
      $('#clubPreview').src = newPicture;
      $('#clubPreview').hidden = false;
      note.textContent = `New picture ready (${describeSize(newPicture)}).`;
    } catch (e) {
      note.textContent = e.message;
      note.classList.add('bad');
    }
  });

  if ($('#clubRemovePicture')) {
    $('#clubRemovePicture').addEventListener('click', () => {
      removePicture = true;
      newPicture = null;
      $('#clubFile').value = '';
      $('#clubPreview').hidden = true;
      $('#clubPictureNote').textContent = 'The picture will be removed when you save.';
    });
  }

  $('#clubSave').addEventListener('click', async () => {
    const { db, firestore } = ctx.fb;
    const clubRef = firestore.doc(db, 'clubs', club.id);
    const imageRef = firestore.doc(db, 'clubImages', club.id);
    const hasImage = newPicture ? true : removePicture ? false : club.hasImage;

    $('#clubSave').disabled = true;
    try {
      const batch = firestore.writeBatch(db);
      const changes = { description: $('#clubText').value.trim(), hasImage, updatedAt: firestore.serverTimestamp() };
      DETAILS.forEach((d) => { changes[d.key] = $(`#club-${d.key}`).value.trim().replace(/\s+/g, ' '); });
      batch.update(clubRef, changes);
      if (newPicture) batch.set(imageRef, { data: newPicture });
      if (removePicture) batch.delete(imageRef);
      await batch.commit();
      if (newPicture) pictureCache.set(club.id, newPicture);
      if (removePicture) pictureCache.delete(club.id);
      closeModal();
      showToast(`Saved ${club.name}.`);
    } catch (e) {
      $('#clubError').textContent = `Couldn't save (${e.code || e.message}).`;
      $('#clubSave').disabled = false;
    }
  });
}

// ---- Add the whole club list from the school website ----
async function loadSchoolClubs() {
  // data/clubs.json is refreshed every day by the GitHub Action; if it's
  // missing (or empty) use the built-in copy in js/club-list.js.
  try {
    const response = await fetch('data/clubs.json', { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.clubs) && data.clubs.length) return data.clubs;
    }
  } catch (e) { /* use the built-in list */ }
  return SCHOOL_CLUBS;
}

function slugFor(name, taken) {
  const base = name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'club';
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

async function openImportClubs(ctx, existingClubs) {
  const body = openModal({
    title: 'Add clubs from the school website',
    html: '<p class="modal-hint">Loading the club list…</p>',
  });
  const schoolClubs = await loadSchoolClubs();
  const have = new Set(existingClubs.map((c) => c.name.toLowerCase()));
  const missing = schoolClubs.filter((c) => c.name && !have.has(c.name.trim().toLowerCase()));

  if (!missing.length) {
    body.innerHTML = `<p class="modal-hint">Every club from the <a href="${SCHOOL_CLUBS_PAGE}" target="_blank" rel="noopener">school's club list</a> is already on the board.</p>`;
    return;
  }
  body.innerHTML = `
    <p class="modal-hint">These clubs from the <a href="${SCHOOL_CLUBS_PAGE}" target="_blank" rel="noopener">school's club list</a> aren't on the board yet.
      Each one comes with its advisor, meeting day, time and room, which you can change later with <strong>Edit Club</strong>.
      Untick any you don't want.</p>
    <label class="import-all"><input type="checkbox" id="importAll" checked> <strong>All ${missing.length} clubs</strong></label>
    <div class="import-list">
      ${missing.map((c, i) => `<label class="import-item"><input type="checkbox" data-index="${i}" checked>
        <span><strong>${esc(c.name)}</strong><small>${esc([c.advisor, c.meetingDay, c.meetingTime, c.room].filter(Boolean).join(' · '))}</small></span></label>`).join('')}
    </div>
    <p class="form-error" id="importError" role="alert"></p>
    <button class="btn-primary" id="importSave">Add ${missing.length} Clubs</button>`;

  const $ = (sel) => body.querySelector(sel);
  const boxes = [...body.querySelectorAll('[data-index]')];
  const count = () => boxes.filter((b) => b.checked).length;
  const refresh = () => {
    const n = count();
    $('#importSave').textContent = n === 1 ? 'Add 1 Club' : `Add ${n} Clubs`;
    $('#importSave').disabled = n === 0;
    $('#importAll').checked = n === boxes.length;
    $('#importAll').indeterminate = n > 0 && n < boxes.length;
  };
  $('#importAll').addEventListener('change', () => { boxes.forEach((b) => { b.checked = $('#importAll').checked; }); refresh(); });
  boxes.forEach((b) => b.addEventListener('change', refresh));

  $('#importSave').addEventListener('click', async () => {
    const chosen = boxes.filter((b) => b.checked).map((b) => missing[Number(b.dataset.index)]);
    const { db, firestore } = ctx.fb;
    const taken = new Set(existingClubs.map((c) => c.id));
    const text = (v, max) => String(v || '').trim().replace(/\s+/g, ' ').slice(0, max);
    $('#importSave').disabled = true;
    $('#importSave').textContent = 'Adding…';
    try {
      const batch = firestore.writeBatch(db);   // up to 500 at once; the school list is ~60
      chosen.forEach((c) => {
        batch.set(firestore.doc(db, 'clubs', slugFor(c.name, taken)), {
          name: text(c.name, 100),
          advisor: text(c.advisor, 200),
          meetingDay: text(c.meetingDay, 200),
          meetingTime: text(c.meetingTime, 200),
          room: text(c.room, 200),
          description: '',
          hasImage: false,
          createdAt: firestore.serverTimestamp(),
        });
      });
      await batch.commit();
      closeModal();
      showToast(chosen.length === 1 ? 'Added 1 club.' : `Added ${chosen.length} clubs.`);
    } catch (e) {
      $('#importError').textContent = `Couldn't add them (${e.code || e.message}).`;
      refresh();
    }
  });
}

async function deleteClub(ctx, club) {
  const { db, firestore } = ctx.fb;
  const clubRef = firestore.doc(db, 'clubs', club.id);
  const imageRef = firestore.doc(db, 'clubImages', club.id);

  // Keep a full copy (including the picture) for Undo
  let saved, picture = null;
  try {
    const snap = await firestore.getDoc(clubRef);
    if (!snap.exists()) return;
    saved = snap.data();
    if (club.hasImage) {
      const img = await firestore.getDoc(imageRef);
      if (img.exists()) picture = img.data().data;
    }
    const batch = firestore.writeBatch(db);
    batch.delete(clubRef);
    if (club.hasImage) batch.delete(imageRef);
    await batch.commit();
  } catch (e) {
    showToast(`Couldn't delete it (${e.code || e.message}).`);
    return;
  }

  showToast(`Deleted "${club.name}".`, {
    action: 'Undo',
    seconds: UNDO_SECONDS,
    onAction: async () => {
      const batch = firestore.writeBatch(db);
      batch.set(clubRef, saved);
      if (picture) batch.set(imageRef, { data: picture });
      try { await batch.commit(); } catch (e) { showToast(`Couldn't undo (${e.code || e.message}).`); }
    },
  });
}

// ---------- The section ----------
export const clubsSection = {
  id: 'clubs',
  label: 'Club Information',
  icon: ICON_CLUBS,

  mount(el, param, ctx) {
    return param ? mountClub(el, param, ctx) : mountBoard(el, ctx);
  },
};
