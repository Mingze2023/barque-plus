// ============================================================
// Q&A section (Step 10)
//
// Questions and replies, saved in Firestore:
//   qa/{questionId}          { text, uid, username, createdAt, up, down }
//   qaReplies/{replyId}      { questionId, text, uid, username, createdAt }
//   users/{userId}/qaVotes/{questionId}   { value: 1 or -1 }   one vote per account
//   users/{userId}/limits/qa              { day, count }   (see js/limits.js)
//
// Daily limits come from js/limits.js: students and club leaders can post
// 5 questions and replies per day in total; teachers and editors, unlimited.
// Every post is checked by the language filter (js/filter.js) first.
//
// You can delete your own questions and replies (deleting your question
// also removes its replies).
// Editor Mode: a trash bin on every question and reply, with Undo.
// ============================================================
import { esc, formatDate, enterSends } from './util.js';
import { showToast } from './toast.js';
import { openModal, closeModal } from './modal.js';
import { prepareLimit, limitMessageAfterRefusal, limitText, pacificDay, nextLimit } from './limits.js';
import { findBadLanguage, markBadLanguage, BAD_LANGUAGE } from './filter.js';

// (kept for older imports)
export { pacificDay, nextLimit };

const LIMIT = 500;
const UNDO_SECONDS = 10;

const ICON_QA = '<path d="M4 5h16v11H9l-5 4z"/><path d="M10 9a2 2 0 1 1 2.5 1.9c-.4.1-.5.4-.5.8v.3M12 14h.01"/>';
const ICON_UP = '<svg viewBox="0 0 24 24"><path d="M12 5l7 9H5z"/></svg>';
const ICON_DOWN = '<svg viewBox="0 0 24 24"><path d="M12 19l-7-9h14z"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';

let listState = { search: '', sort: 'recent' };

// ---------- Posting (a question or a reply) ----------
// Returns '' when it worked, or a message to show in red.
async function post(ctx, kind, data) {
  const { db, firestore } = ctx.fb;
  const limit = await prepareLimit(ctx, 'qa');
  if (limit.message) return limit.message;

  const ref = firestore.doc(firestore.collection(db, kind === 'question' ? 'qa' : 'qaReplies'));
  const batch = firestore.writeBatch(db);
  const base = { text: data.text, uid: ctx.profile.uid, username: ctx.profile.username, createdAt: firestore.serverTimestamp() };
  if (kind === 'question') batch.set(ref, { ...base, up: 0, down: 0 });
  else batch.set(ref, { ...base, questionId: data.questionId });
  if (limit.ref) batch.set(limit.ref, limit.record);

  try {
    await batch.commit();
    return '';
  } catch (e) {
    if (e.code === 'permission-denied') {
      const message = await limitMessageAfterRefusal(ctx, 'qa');
      if (message) return message;
    }
    return `It couldn't be posted (${e.code || e.message}).`;
  }
}

function counterHTML(id) {
  return `<span class="comment-counter" id="${id}">0 / ${LIMIT}</span>`;
}

function hookCounter(textarea, counter) {
  textarea.addEventListener('input', () => {
    counter.textContent = `${textarea.value.length} / ${LIMIT}`;
    counter.classList.toggle('full', textarea.value.length >= LIMIT);
  });
}

function checkText(text, what) {
  if (!text) return `Type your ${what} first.`;
  if (text.length > LIMIT) return `${what[0].toUpperCase() + what.slice(1)}s can be at most ${LIMIT} characters.`;
  return '';
}

// ---------- Ask a question (the + button) ----------
function openAsk(ctx) {
  const body = openModal({
    title: 'Ask a question',
    subtitle: limitText(ctx, 'qa'),
    html: `
      <label class="field modal-field"><span>Your question</span>
        <textarea id="askText" rows="5" maxlength="${LIMIT}" placeholder="What would you like to ask?"></textarea>
      </label>
      <div class="comment-form-row">${counterHTML('askCounter')}</div>
      <p class="form-error" id="askError" role="alert"></p>
      <button class="btn-primary" id="askPost">Post Question</button>`,
  });
  const text = body.querySelector('#askText');
  const error = body.querySelector('#askError');
  const button = body.querySelector('#askPost');
  hookCounter(text, body.querySelector('#askCounter'));
  enterSends(text, () => { if (!button.disabled) button.click(); });
  text.focus();
  button.addEventListener('click', async () => {
    const value = text.value.trim();
    error.textContent = checkText(value, 'question');
    if (error.textContent) return;
    button.disabled = true;
    if (await findBadLanguage(value)) {
      error.textContent = BAD_LANGUAGE;
      markBadLanguage(text);
      button.disabled = false;
      return;
    }
    button.textContent = 'Posting…';
    const problem = await post(ctx, 'question', { text: value });
    if (!problem) { closeModal(); showToast('Question posted.'); return; }
    error.textContent = problem;
    button.disabled = false;
    button.textContent = 'Post Question';
  });
}

// ---------- Voting (same way as News: the vote and the counts save together) ----------
async function vote(ctx, question, myVote, clicked) {
  const { db, firestore } = ctx.fb;
  const before = myVote || 0;
  const after = before === clicked ? 0 : clicked;
  const voteRef = firestore.doc(db, 'users', ctx.profile.uid, 'qaVotes', question.id);
  const batch = firestore.writeBatch(db);
  if (after === 0) batch.delete(voteRef);
  else batch.set(voteRef, { value: after });
  batch.update(firestore.doc(db, 'qa', question.id), {
    up: firestore.increment((after === 1 ? 1 : 0) - (before === 1 ? 1 : 0)),
    down: firestore.increment((after === -1 ? 1 : 0) - (before === -1 ? 1 : 0)),
  });
  try {
    await batch.commit();
  } catch (e) {
    showToast(`Your vote couldn't be saved (${e.code || e.message}).`);
  }
}

// ---------- Editor Mode: delete with Undo ----------
async function deleteQuestion(ctx, question, replies) {
  const { db, firestore } = ctx.fb;
  const qRef = firestore.doc(db, 'qa', question.id);
  const saved = { ...question.raw };
  const savedReplies = replies.map((r) => ({ id: r.id, data: { ...r.raw } }));
  const batch = firestore.writeBatch(db);
  batch.delete(qRef);
  savedReplies.forEach((r) => batch.delete(firestore.doc(db, 'qaReplies', r.id)));
  try {
    await batch.commit();
  } catch (e) {
    showToast(`Couldn't delete it (${e.code || e.message}).`);
    return;
  }
  if (!ctx.editorMode) { showToast('Deleted your question.'); return; }
  showToast(`Deleted ${question.username}'s question${replies.length ? ` and ${replies.length === 1 ? 'its reply' : `its ${replies.length} replies`}` : ''}.`, {
    action: 'Undo',
    seconds: UNDO_SECONDS,
    onAction: async () => {
      const undo = firestore.writeBatch(db);
      undo.set(qRef, saved);
      savedReplies.forEach((r) => undo.set(firestore.doc(db, 'qaReplies', r.id), r.data));
      try { await undo.commit(); } catch (e) { showToast(`Couldn't undo (${e.code || e.message}).`); }
    },
  });
}

async function deleteReply(ctx, reply) {
  const { db, firestore } = ctx.fb;
  const ref = firestore.doc(db, 'qaReplies', reply.id);
  const saved = { ...reply.raw };
  try {
    await firestore.deleteDoc(ref);
  } catch (e) {
    showToast(`Couldn't delete it (${e.code || e.message}).`);
    return;
  }
  if (!ctx.editorMode) { showToast('Deleted your reply.'); return; }
  showToast(`Deleted ${reply.username}'s reply.`, {
    action: 'Undo',
    seconds: UNDO_SECONDS,
    onAction: () => firestore.setDoc(ref, saved).catch((e) => showToast(`Couldn't undo (${e.code || e.message}).`)),
  });
}

// ---------- The page ----------
function fromDoc(doc) {
  const d = doc.data();
  return {
    id: doc.id,
    raw: d,
    text: d.text || '',
    username: d.username || 'someone',
    uid: d.uid,
    questionId: d.questionId,
    up: d.up || 0,
    down: d.down || 0,
    // a brand-new post has no server time yet for a moment
    when: d.createdAt && d.createdAt.toDate ? d.createdAt.toDate() : new Date(),
  };
}

function mountQA(el, ctx) {
  const { db, firestore } = ctx.fb;
  let questions = null;
  let replies = null;
  let myVotes = {};
  const drafts = {};          // reply text typed so far, kept when the list redraws
  const replyErrors = {};
  let focused = null;         // which reply box had the cursor
  const badLanguage = {};     // reply boxes showing "Inappropriate language"
  let confirming = null;      // 'q:<id>' or 'r:<id>' waiting for "Delete? Yes"
  const me = ctx.profile.uid;

  // Trash bin: editors (in Editor Mode) on everything, everyone on their own.
  // Your own posts ask "Delete? Yes / No" first (only editors get Undo).
  function trashHTML(kind, item, extraClass = '') {
    const key = `${kind}:${item.id}`;
    if (!ctx.editorMode && item.uid !== me) return '';
    if (confirming === key) {
      return `<span class="lost-confirm qa-confirm">Delete${kind === 'q' ? ' your question' : ''}?
        <button class="link-btn" data-confirm-yes="${esc(key)}">Yes</button><button class="link-btn" data-confirm-no>No</button></span>`;
    }
    const what = kind === 'q' ? 'question' : 'reply';
    return `<button class="trash-btn ${extraClass}" data-trash="${esc(key)}" title="Delete this ${what}" aria-label="Delete this ${what}">${ICON_TRASH}</button>`;
  }

  el.innerHTML = `
    <div class="qa-banner">
      <h2 class="qa-title">Q&amp;A</h2>
      <p>Ask the school a question, or help answer one.</p>
    </div>
    <div class="qa-toolbar">
      <label class="news-search qa-search">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
        <input type="search" id="qaSearch" placeholder="Search questions" value="${esc(listState.search)}">
      </label>
      <label class="news-sort">
        Sort by
        <select id="qaSort">
          <option value="recent">Most recent</option>
          <option value="votes">Most upvoted</option>
        </select>
      </label>
      <button class="qa-ask" id="qaAsk" title="Ask a question" aria-label="Ask a question">+</button>
    </div>
    <div class="qa-list" id="qaList"><div class="placeholder">Loading questions…</div></div>`;

  const list = el.querySelector('#qaList');
  el.querySelector('#qaSort').value = listState.sort;
  el.querySelector('#qaSearch').addEventListener('input', (e) => { listState.search = e.target.value; draw(); });
  el.querySelector('#qaSort').addEventListener('change', (e) => { listState.sort = e.target.value; draw(); });
  el.querySelector('#qaAsk').addEventListener('click', () => openAsk(ctx));

  function repliesFor(id) {
    return (replies || []).filter((r) => r.questionId === id).sort((a, b) => a.when - b.when);
  }

  function draw() {
    if (!questions || !replies) return;
    const words = listState.search.trim().toLowerCase();
    let shown = questions.filter((q) => !words
      || [q.text, q.username, ...repliesFor(q.id).map((r) => r.text)].join(' ').toLowerCase().includes(words));
    shown = shown.sort(listState.sort === 'votes'
      ? (a, b) => (b.up - b.down) - (a.up - a.down) || b.when - a.when
      : (a, b) => b.when - a.when);

    if (!questions.length) {
      list.innerHTML = '<div class="placeholder">No questions yet. Click <strong>+</strong> to ask the first one!</div>';
      return;
    }
    if (!shown.length) {
      list.innerHTML = `<div class="placeholder">No questions match “${esc(listState.search)}”.</div>`;
      return;
    }

    list.innerHTML = shown.map((q) => {
      const rs = repliesFor(q.id);
      const mine = myVotes[q.id] || 0;
      return `
        <article class="qa-card" data-question="${esc(q.id)}">
          <div class="qa-main">
            <div class="qa-question">
              <span class="qa-q">Q</span>
              <div class="qa-question-body">
                <p class="qa-text">${esc(q.text)}</p>
                <div class="comment-head"><strong>${esc(q.username)}</strong> · ${esc(formatDate(q.when))}</div>
              </div>
            </div>
            ${trashHTML('q', q, 'qa-trash')}
            <div class="vote-box" data-vote="${esc(q.id)}">
              <button class="vote-up${mine === 1 ? ' voted' : ''}" title="Upvote" aria-label="Upvote">${ICON_UP}</button>
              <span class="vote-score" title="${q.up} up, ${q.down} down">${q.up - q.down}</span>
              <button class="vote-down${mine === -1 ? ' voted' : ''}" title="Downvote" aria-label="Downvote">${ICON_DOWN}</button>
            </div>
          </div>
          <div class="qa-replies">
            ${rs.length ? `<ul class="comment-list qa-reply-list">${rs.map((r) => `
              <li class="comment">
                <div class="comment-head"><strong>${esc(r.username)}</strong> · ${esc(formatDate(r.when))}</div>
                <p class="comment-text">${esc(r.text)}</p>
                ${trashHTML('r', r)}
              </li>`).join('')}</ul>` : ''}
            <form class="qa-reply-form" data-reply-form="${esc(q.id)}">
              <textarea rows="1" maxlength="${LIMIT}" placeholder="Write a reply" aria-label="Write a reply"${badLanguage[q.id] ? ' class="bad-language"' : ''}>${esc(drafts[q.id] || '')}</textarea>
              <button type="submit" class="btn-primary qa-reply-post">Reply</button>
              <span class="comment-counter">${(drafts[q.id] || '').length} / ${LIMIT}</span>
              <p class="form-error qa-reply-error" role="alert">${esc(replyErrors[q.id] || '')}</p>
            </form>
          </div>
        </article>`;
    }).join('');

    // votes
    list.querySelectorAll('[data-vote]').forEach((box) => {
      const q = questions.find((x) => x.id === box.dataset.vote);
      box.querySelector('.vote-up').addEventListener('click', () => vote(ctx, q, myVotes[q.id], 1));
      box.querySelector('.vote-down').addEventListener('click', () => vote(ctx, q, myVotes[q.id], -1));
    });

    // reply boxes
    list.querySelectorAll('[data-reply-form]').forEach((form) => {
      const id = form.dataset.replyForm;
      const text = form.querySelector('textarea');
      const counter = form.querySelector('.comment-counter');
      const error = form.querySelector('.qa-reply-error');
      const button = form.querySelector('button');
      hookCounter(text, counter);
      enterSends(text, () => { if (!button.disabled) form.requestSubmit(); });
      text.addEventListener('input', () => { drafts[id] = text.value; badLanguage[id] = false; text.classList.remove('bad-language'); });
      text.addEventListener('focus', () => { focused = id; });
      text.addEventListener('blur', () => { if (focused === id) focused = null; });
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const value = text.value.trim();
        error.textContent = replyErrors[id] = checkText(value, 'reply');
        if (error.textContent) return;
        button.disabled = true;
        if (await findBadLanguage(value)) {
          error.textContent = replyErrors[id] = BAD_LANGUAGE;
          badLanguage[id] = true;
          const live = list.querySelector(`[data-reply-form="${CSS.escape(id)}"]`);
          if (live) {
            live.querySelector('.qa-reply-error').textContent = BAD_LANGUAGE;
            markBadLanguage(live.querySelector('textarea'));
            live.querySelector('button').disabled = false;
          }
          return;
        }
        const problem = await post(ctx, 'reply', { text: value, questionId: id });
        replyErrors[id] = problem;
        if (!problem) drafts[id] = '';
        // the list redraws by itself when the reply arrives; show errors now
        const live = list.querySelector(`[data-reply-form="${CSS.escape(id)}"]`);
        if (live) {
          live.querySelector('.qa-reply-error').textContent = problem;
          live.querySelector('button').disabled = false;
          if (!problem) { live.querySelector('textarea').value = ''; live.querySelector('.comment-counter').textContent = `0 / ${LIMIT}`; }
        }
      });
    });
    if (focused) {
      const box = list.querySelector(`[data-reply-form="${CSS.escape(focused)}"] textarea`);
      if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
    }

    // Deleting
    const doDelete = (key) => {
      const [kind, id] = [key.slice(0, 1), key.slice(2)];
      if (kind === 'q') {
        const q = questions.find((x) => x.id === id);
        if (q) deleteQuestion(ctx, q, repliesFor(q.id));
      } else {
        const r = replies.find((x) => x.id === id);
        if (r) deleteReply(ctx, r);
      }
    };
    list.querySelectorAll('[data-trash]').forEach((b) => b.addEventListener('click', () => {
      const key = b.dataset.trash;
      const item = key.startsWith('q:') ? questions.find((x) => x.id === key.slice(2)) : replies.find((x) => x.id === key.slice(2));
      if (ctx.editorMode) doDelete(key);          // editors: delete now, Undo in the toast
      else if (item && item.uid === me) { confirming = key; draw(); }
    }));
    list.querySelectorAll('[data-confirm-yes]').forEach((b) => b.addEventListener('click', () => {
      confirming = null;
      doDelete(b.dataset.confirmYes);
    }));
    list.querySelectorAll('[data-confirm-no]').forEach((b) => b.addEventListener('click', () => { confirming = null; draw(); }));
  }

  const failed = (what) => (e) => {
    list.innerHTML = `<p class="form-error">The ${what} couldn't load (${esc(e.code || e.message)}).</p>`;
  };
  const stops = [
    firestore.onSnapshot(firestore.collection(db, 'qa'), (snap) => { questions = snap.docs.map(fromDoc); draw(); }, failed('questions')),
    firestore.onSnapshot(firestore.collection(db, 'qaReplies'), (snap) => { replies = snap.docs.map(fromDoc); draw(); }, failed('replies')),
    firestore.onSnapshot(firestore.collection(db, 'users', ctx.profile.uid, 'qaVotes'), (snap) => {
      myVotes = {};
      snap.docs.forEach((d) => { myVotes[d.id] = d.data().value; });
      draw();
    }, () => {}),
  ];
  return () => stops.forEach((stop) => stop());
}

// ---------- The section ----------
export const qaSection = {
  id: 'qa',
  label: 'Q&A',
  icon: ICON_QA,
  mount(el, param, ctx) {
    return mountQA(el, ctx);
  },
  reset() {
    listState = { search: '', sort: 'recent' };
  },
};
