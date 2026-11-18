// ============================================================
// Daily Poll (Step 12) - on every page, under the Lost Items tab
//
// When there's a poll, a pulsating link with its name opens the
// Microsoft Forms link an editor put in. The site can't see whether a Form
// was really submitted, so after you open it we ask "Did you fill it out?".
// Clicking Yes hides the link for you (saved to your account).
//
// Saved in Firestore:
//   site/poll                          { name, url, pollId, createdAt }
//   users/{you}/pollsDone/{pollId}     { at }
//
// Editor Mode: an "Add Poll" button on every page (paste the Forms link and
// type the name). A new poll replaces the current one; "Remove Poll" takes
// it down (with Undo).
// ============================================================
import { esc } from './util.js';
import { showToast } from './toast.js';
import { openModal, closeModal } from './modal.js';

const NAME_LIMIT = 80;
// Microsoft Forms addresses (the rules accept the same ones)
const FORMS_HOSTS = ['forms.office.com', 'forms.microsoft.com', 'forms.cloud.microsoft'];

const ICON_POLL = '<svg viewBox="0 0 24 24"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>';

// Returns a clean https link, or '' if it isn't a Microsoft Forms link
export function readFormsLink(text) {
  let value = String(text || '').trim();
  if (!value) return '';
  if (!/^[a-z]+:\/\//i.test(value)) value = `https://${value}`;
  let url;
  try { url = new URL(value); } catch (e) { return ''; }
  if (url.protocol === 'http:') url.protocol = 'https:';
  if (url.protocol !== 'https:' || !FORMS_HOSTS.includes(url.hostname.toLowerCase())) return '';
  url.hostname = url.hostname.toLowerCase();
  return url.href.slice(0, 1000);
}

function openPollEditor(ctx, current) {
  const body = openModal({
    title: 'Add a poll',
    subtitle: current ? `This replaces the current poll, “${current.name}”.` : 'The poll name shows as a pulsating link at the top of every page.',
    html: `
      <label class="field modal-field"><span>Microsoft Forms link</span>
        <input type="url" id="pollUrl" placeholder="https://forms.office.com/r/…" autocomplete="off">
      </label>
      <label class="field modal-field"><span>Poll name (shown in the link)</span>
        <input type="text" id="pollName" maxlength="${NAME_LIMIT}" placeholder="New Daily Poll" autocomplete="off">
      </label>
      <p class="form-error" id="pollError" role="alert"></p>
      <button class="btn-primary" id="pollSave">${current ? 'Replace Poll' : 'Add Poll'}</button>`,
  });
  const $ = (sel) => body.querySelector(sel);
  $('#pollUrl').focus();
  $('#pollSave').addEventListener('click', async () => {
    const url = readFormsLink($('#pollUrl').value);
    const name = $('#pollName').value.trim().replace(/\s+/g, ' ');
    const error = $('#pollError');
    if (!$('#pollUrl').value.trim()) { error.textContent = 'Paste the Microsoft Forms link first.'; return; }
    if (!url) { error.textContent = "That doesn't look like a Microsoft Forms link. It should start with https://forms.office.com/ (or forms.microsoft.com)."; return; }
    if (!name) { error.textContent = 'Type a name for the poll.'; return; }
    error.textContent = '';
    $('#pollSave').disabled = true;
    const { db, firestore } = ctx.fb;
    try {
      await firestore.setDoc(firestore.doc(db, 'site', 'poll'), {
        name,
        url,
        // a new id each time, so everyone sees the new poll even if they said Yes to the old one
        pollId: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        createdAt: firestore.serverTimestamp(),
      });
      closeModal();
      showToast(current ? 'Poll replaced.' : 'Poll added.');
    } catch (e) {
      error.textContent = `Couldn't save the poll (${e.code || e.message}).`;
      $('#pollSave').disabled = false;
    }
  });
}

// Returns { refresh(), stop() }
export function startPoll(el, getCtx) {
  const { db, firestore } = getCtx().fb;
  const pollRef = firestore.doc(db, 'site', 'poll');
  let poll;               // undefined = loading, null = no poll
  let doneFor = null;     // pollId you've said Yes to
  let opened = false;     // opened the link this visit, so ask "Did you fill it out?"
  let stopDone = null;

  function watchDone() {
    if (stopDone) { stopDone(); stopDone = null; }
    doneFor = null;
    if (!poll) return;
    const ctx = getCtx();
    stopDone = firestore.onSnapshot(firestore.doc(db, 'users', ctx.profile.uid, 'pollsDone', poll.pollId), (snap) => {
      doneFor = snap.exists() ? poll.pollId : null;
      draw();
    }, () => {});
  }

  function draw() {
    const ctx = getCtx();
    if (!ctx || poll === undefined) { el.innerHTML = ''; return; }
    const showLink = poll && doneFor !== poll.pollId;
    const editor = ctx.editorMode;
    if (!showLink && !editor) { el.innerHTML = ''; return; }

    el.innerHTML = `
      <div class="poll-row">
        ${showLink ? `
          <a class="poll-link" id="pollLink" href="${esc(poll.url)}" target="_blank" rel="noopener">
            ${ICON_POLL}<span>${esc(poll.name)}</span>
          </a>
          ${opened ? `<span class="poll-ask" role="status">Did you fill it out?
            <button class="poll-yes" id="pollYes">Yes</button>
            <button class="link-btn" id="pollNotYet">Not yet</button></span>` : ''}` : ''}
        ${editor ? `
          <span class="poll-editor-tools">
            <button class="poll-tool" id="pollAdd">Add Poll</button>
            ${poll ? '<button class="poll-tool remove" id="pollRemove">Remove Poll</button>' : ''}
          </span>` : ''}
      </div>
      ${editor && poll && !showLink ? `<div class="poll-editor-note">You've answered “${esc(poll.name)}”, so its link is hidden for you.</div>` : ''}`;

    const link = el.querySelector('#pollLink');
    if (link) link.addEventListener('click', () => { opened = true; setTimeout(draw, 0); });
    const yes = el.querySelector('#pollYes');
    if (yes) yes.addEventListener('click', async () => {
      yes.disabled = true;
      try {
        await firestore.setDoc(firestore.doc(db, 'users', getCtx().profile.uid, 'pollsDone', poll.pollId), { at: firestore.serverTimestamp() });
        opened = false;
        doneFor = poll.pollId;
        draw();
        showToast('Thanks for filling out the poll!');
      } catch (e) {
        showToast(`Couldn't save that (${e.code || e.message}).`);
        yes.disabled = false;
      }
    });
    const notYet = el.querySelector('#pollNotYet');
    if (notYet) notYet.addEventListener('click', () => { opened = false; draw(); });
    const add = el.querySelector('#pollAdd');
    if (add) add.addEventListener('click', () => openPollEditor(getCtx(), poll));
    const remove = el.querySelector('#pollRemove');
    if (remove) remove.addEventListener('click', removePoll);
  }

  async function removePoll() {
    const saved = poll && { ...poll.raw };
    try {
      await firestore.deleteDoc(pollRef);
    } catch (e) {
      showToast(`Couldn't remove the poll (${e.code || e.message}).`);
      return;
    }
    showToast(`Removed “${saved.name}”.`, {
      action: 'Undo',
      seconds: 10,
      onAction: () => firestore.setDoc(pollRef, saved).catch((e) => showToast(`Couldn't undo (${e.code || e.message}).`)),
    });
  }

  const stopPoll = firestore.onSnapshot(pollRef, (snap) => {
    const before = poll && poll.pollId;
    if (snap.exists() && snap.data().url && snap.data().pollId) {
      const d = snap.data();
      poll = { raw: d, name: d.name || 'Poll', url: d.url, pollId: d.pollId };
    } else {
      poll = null;
    }
    if ((poll && poll.pollId) !== before) { opened = false; watchDone(); }
    draw();
  }, () => { poll = null; draw(); });

  return {
    refresh: draw,
    stop() {
      stopPoll();
      if (stopDone) stopDone();
      el.innerHTML = '';
    },
  };
}
