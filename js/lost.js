// ============================================================
// Lost Items (Step 11) - on every page
//
// A small "Lost Items" tab at the top of the page that slowly changes
// color. Hover over it (or click it) and it pulls down into a menu of lost
// items, newest at the top, older ones fading out below.
//
// Saved in Firestore:
//   lostItems/{id}   { text, uid, username, createdAt, updatedAt? }
//   users/{you}/limits/lost   { day }   (students: 1 new entry per day)
//
// - Anyone can add an entry (200 characters), and edit or delete their own.
// - Entries older than 14 days are hidden right away, and the daily GitHub
//   Action deletes them for good (scripts/cleanup_lost_items.py).
// - Editor Mode: every entry gets a trash bin (with Undo).
// ============================================================
import { esc, enterSends } from './util.js';
import { showToast } from './toast.js';
import { openModal, closeModal } from './modal.js';
import { prepareLimit, limitMessageAfterRefusal, limitText } from './limits.js';
import { findBadLanguage, markBadLanguage, BAD_LANGUAGE } from './filter.js';

const LIMIT = 200;
const MAX_AGE_DAYS = 14;
const DAY_MS = 86400000;

const ICON_PLUS = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_EDIT = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';
const ICON_TAG = '<svg viewBox="0 0 24 24"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/></svg>';

function ageText(when) {
  const days = Math.floor((Date.now() - when) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}


// ---------- Adding and editing ----------
function openEntryEditor(ctx, existing) {
  const editing = Boolean(existing);
  const body = openModal({
    title: editing ? 'Edit your lost item' : 'Add a lost item',
    subtitle: editing ? '' : `Describe what was lost (or found) and where.${limitText(ctx, 'lost') ? ` ${limitText(ctx, 'lost')}` : ''} Entries disappear after 14 days.`,
    html: `
      <label class="field modal-field"><span>Description</span>
        <textarea id="lostText" rows="3" maxlength="${LIMIT}" placeholder="e.g. Blue Hydro Flask with stickers, left in the library on Tuesday"></textarea>
      </label>
      <div class="comment-form-row"><span class="comment-counter" id="lostCounter">0 / ${LIMIT}</span></div>
      <p class="form-error" id="lostError" role="alert"></p>
      <button class="btn-primary" id="lostSave">${editing ? 'Save' : 'Add'}</button>`,
  });
  const $ = (sel) => body.querySelector(sel);
  const text = $('#lostText');
  const counter = $('#lostCounter');
  const update = () => {
    counter.textContent = `${text.value.length} / ${LIMIT}`;
    counter.classList.toggle('full', text.value.length >= LIMIT);
  };
  text.addEventListener('input', update);
  if (editing) text.value = existing.text;
  update();
  text.focus();

  enterSends(text, () => { if (!$('#lostSave').disabled) $('#lostSave').click(); });
  $('#lostSave').addEventListener('click', async () => {
    const value = text.value.trim().replace(/\s+/g, ' ');
    const error = $('#lostError');
    if (!value) { error.textContent = 'Type a description first.'; return; }
    if (value.length > LIMIT) { error.textContent = `Descriptions can be at most ${LIMIT} characters.`; return; }
    error.textContent = '';
    $('#lostSave').disabled = true;
    if (await findBadLanguage(value)) {
      error.textContent = BAD_LANGUAGE;
      markBadLanguage(text);
      $('#lostSave').disabled = false;
      return;
    }
    const problem = editing ? await saveEdit(ctx, existing, value) : await addEntry(ctx, value);
    if (!problem) {
      closeModal();
      showToast(editing ? 'Lost item updated.' : 'Lost item added.');
      return;
    }
    error.textContent = problem;
    $('#lostSave').disabled = false;
  });
}

async function addEntry(ctx, text) {
  const { db, firestore } = ctx.fb;
  const limit = await prepareLimit(ctx, 'lost');
  if (limit.message) return limit.message;

  const batch = firestore.writeBatch(db);
  batch.set(firestore.doc(firestore.collection(db, 'lostItems')), {
    text,
    uid: ctx.profile.uid,
    username: ctx.profile.username,
    createdAt: firestore.serverTimestamp(),
  });
  if (limit.ref) batch.set(limit.ref, limit.record);
  try {
    await batch.commit();
    return '';
  } catch (e) {
    if (e.code === 'permission-denied') {
      const message = await limitMessageAfterRefusal(ctx, 'lost');
      if (message) return message;
    }
    return `It couldn't be added (${e.code || e.message}).`;
  }
}

async function saveEdit(ctx, entry, text) {
  const { db, firestore } = ctx.fb;
  try {
    await firestore.updateDoc(firestore.doc(db, 'lostItems', entry.id), { text, updatedAt: firestore.serverTimestamp() });
    return '';
  } catch (e) {
    return `It couldn't be saved (${e.code || e.message}).`;
  }
}

// ---------- The tab and its menu ----------
// Returns { refresh(), stop() }. refresh() redraws (e.g. when Editor Mode changes).
export function startLostItems(el, getCtx) {
  let entries = null;
  let failed = '';
  let confirming = null;      // id of your entry waiting for "Delete?" Yes
  const ctx0 = getCtx();
  const { db, firestore } = ctx0.fb;

  el.innerHTML = `
    <div class="lost" id="lost">
      <button class="lost-tab" id="lostTab" aria-expanded="false" aria-controls="lostMenu">
        ${ICON_TAG}<span>Lost Items</span><span class="lost-count" id="lostCount"></span>
      </button>
      <div class="lost-menu" id="lostMenu" role="region" aria-label="Lost items">
        <div class="lost-menu-head">
          <strong>Lost Items</strong>
          <span class="lost-menu-note">Last 14 days</span>
          <button class="lost-add" id="lostAdd" title="Add a lost item" aria-label="Add a lost item">${ICON_PLUS}</button>
        </div>
        <ul class="lost-list" id="lostList"><li class="lost-empty">Loading…</li></ul>
      </div>
    </div>`;

  const box = el.querySelector('#lost');
  const tab = el.querySelector('#lostTab');
  const list = el.querySelector('#lostList');

  // Hover opens it (CSS). Clicking the tab also pins it open, for keyboards and touch.
  tab.addEventListener('click', () => {
    const open = box.classList.toggle('pinned');
    tab.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', outside);
  function outside(e) {
    if (!box.contains(e.target) && !e.target.closest('.modal-overlay, .toast')) {
      box.classList.remove('pinned');
      tab.setAttribute('aria-expanded', 'false');
    }
  }
  el.querySelector('#lostAdd').addEventListener('click', () => {
    box.classList.remove('pinned');
    openEntryEditor(getCtx());
  });

  function visible() {
    const cutoff = Date.now() - MAX_AGE_DAYS * DAY_MS;
    return (entries || []).filter((e) => e.when > cutoff).sort((a, b) => b.when - a.when);
  }

  function draw() {
    const ctx = getCtx();
    if (!ctx) return;
    const shown = visible();
    el.querySelector('#lostCount').textContent = shown.length ? shown.length : '';
    if (failed) { list.innerHTML = `<li class="lost-empty">${esc(failed)}</li>`; return; }
    if (!entries) return;
    if (!shown.length) {
      list.innerHTML = '<li class="lost-empty">No lost items right now. Click <strong>+</strong> to add one.</li>';
      return;
    }
    list.innerHTML = shown.map((e, i) => {
      const mine = e.uid === ctx.profile.uid;
      // newest is solid; older entries (further down) fade out
      const age = (Date.now() - e.when) / (MAX_AGE_DAYS * DAY_MS);
      const fade = Math.max(0.3, 1 - Math.min(1, age) * 0.5 - Math.min(i, 10) * 0.04);
      const tools = [];
      if (mine && confirming === e.id) {
        tools.push(`<span class="lost-confirm">Delete? <button class="link-btn" data-yes="${esc(e.id)}">Yes</button><button class="link-btn" data-no>No</button></span>`);
      } else {
        if (mine) tools.push(`<button class="lost-tool" data-edit="${esc(e.id)}" title="Edit" aria-label="Edit your entry">${ICON_EDIT}</button>`);
        if (mine || ctx.editorMode) tools.push(`<button class="lost-tool trash" data-delete="${esc(e.id)}" title="Delete" aria-label="Delete this entry">${ICON_TRASH}</button>`);
      }
      return `
        <li class="lost-item${mine ? ' mine' : ''}" style="opacity:${fade.toFixed(2)}">
          <div class="lost-item-text">
            <span>${esc(e.text)}</span>
            <span class="lost-by">${esc(e.username)} · ${ageText(e.when)}${e.edited ? ' · edited' : ''}</span>
          </div>
          ${tools.length ? `<div class="lost-tools">${tools.join('')}</div>` : ''}
        </li>`;
    }).join('');

    list.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
      box.classList.remove('pinned');
      openEntryEditor(getCtx(), entries.find((e) => e.id === b.dataset.edit));
    }));
    list.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', () => {
      const entry = entries.find((e) => e.id === b.dataset.delete);
      const c = getCtx();
      if (entry.uid === c.profile.uid && !c.editorMode) { confirming = entry.id; draw(); }
      else remove(entry);
    }));
    list.querySelectorAll('[data-yes]').forEach((b) => b.addEventListener('click', () => {
      confirming = null;
      remove(entries.find((e) => e.id === b.dataset.yes));
    }));
    list.querySelectorAll('[data-no]').forEach((b) => b.addEventListener('click', () => { confirming = null; draw(); }));
  }

  async function remove(entry) {
    const ctx = getCtx();
    const ref = firestore.doc(db, 'lostItems', entry.id);
    try {
      await firestore.deleteDoc(ref);
    } catch (e) {
      showToast(`Couldn't delete it (${e.code || e.message}).`);
      return;
    }
    // Editors get Undo (the rules let editors put an entry back as it was)
    if (ctx && ctx.editorMode) {
      showToast(entry.uid === ctx.profile.uid ? 'Deleted your lost item.' : `Deleted ${entry.username}'s lost item.`, {
        action: 'Undo',
        seconds: 10,
        onAction: () => firestore.setDoc(ref, entry.raw).catch((e) => showToast(`Couldn't undo (${e.code || e.message}).`)),
      });
    } else {
      showToast('Deleted your lost item.');
    }
  }

  const newestFirst = firestore.query(firestore.collection(db, 'lostItems'), firestore.orderBy('createdAt', 'desc'));
  const stopListening = firestore.onSnapshot(newestFirst, (snap) => {
    failed = '';
    entries = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        raw: d,
        text: d.text || '',
        uid: d.uid,
        username: d.username || 'someone',
        edited: Boolean(d.updatedAt),
        when: d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().getTime() : Date.now(),
      };
    });
    draw();
  }, (e) => {
    failed = `Lost items couldn't load (${e.code || e.message}).`;
    draw();
  });
  // Entries pass 14 days while the page is open, too
  const timer = setInterval(draw, 10 * 60 * 1000);

  return {
    refresh: draw,
    stop() {
      stopListening();
      clearInterval(timer);
      document.removeEventListener('click', outside);
      el.innerHTML = '';
    },
  };
}
