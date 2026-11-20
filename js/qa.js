// ============================================================
// Q&A section (Step 10)
//
// Questions and replies, saved in Firestore:
//   qa/{questionId}          { text, uid, username, createdAt, up, down }
//   qaReplies/{replyId}      { questionId, text, uid, username, createdAt }
//   users/{userId}/qaVotes/{questionId}   { value: 1 or -1 }   one vote per account
//   users/{userId}/limits/qa              { day, count }   posts made on "day"
//
// Daily limit: students can post 5 questions and replies per day in total
// (DAILY_POSTS). Every post is saved together with users/{you}/limits/qa,
// and the security rules only accept the post if that count goes up by one
// (or starts again at 1 on a new day, Bellevue time, at midnight) and stays
// within the limit. Editors have no limit.
// (Teachers get unlimited posts in Step 15.)
//
// Editor Mode: a trash bin on every question and reply, with Undo.
// ============================================================
import { esc, formatDate, enterSends } from './util.js';
import { showToast } from './toast.js';
import { openModal, closeModal } from './modal.js';

const LIMIT = 500;
const UNDO_SECONDS = 10;
const DAILY_POSTS = 5;   // keep the same as dailyMax('qa') in firestore.rules
const LIMIT_MESSAGE = `You've already posted ${DAILY_POSTS} questions and replies today (the daily limit). You can post again tomorrow.`;

const ICON_QA = '<path d="M4 5h16v11H9l-5 4z"/><path d="M10 9a2 2 0 1 1 2.5 1.9c-.4.1-.5.4-.5.8v.3M12 14h.01"/>';
const ICON_UP = '<svg viewBox="0 0 24 24"><path d="M12 5l7 9H5z"/></svg>';
const ICON_DOWN = '<svg viewBox="0 0 24 24"><path d="M12 19l-7-9h14z"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';

let listState = { search: '', sort: 'recent' };

// ---------- Today's date in Bellevue, as a day number ----------
// (days since Jan 1 1970). The security rules work out the same number.
export function pacificDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return Date.UTC(get('year'), get('month') - 1, get('day')) / 86400000;
}

// The daily-limit record to save with your next post, or null if you've
// used up today's limit. (Older records have no count; they mean 1.)
export function nextLimit(snap, today, max) {
  const old = snap && snap.exists() ? snap.data() : null;
  if (!old || old.day < today) return { day: today, count: 1 };
  const used = typeof old.count === 'number' ? old.count : 1;
  return used < max ? { day: today, count: used + 1 } : null;
}

function hasDailyLimit(ctx) {
  return !ctx.profile.isEditor;
}

// ---------- Posting (a question or a reply) ----------
// Returns '' when it worked, or a message to show in red.
async function post(ctx, kind, data) {
  const { db, firestore } = ctx.fb;
  const limitRef = firestore.doc(db, 'users', ctx.profile.uid, 'limits', 'qa');
  const today = pacificDay();
  const limited = hasDailyLimit(ctx);

  let limitRecord = null;
  if (limited) {
    let snap = null;
    try { snap = await firestore.getDoc(limitRef); } catch (e) { /* the rules still check it */ }
    limitRecord = nextLimit(snap, today, DAILY_POSTS);
    if (!limitRecord) return LIMIT_MESSAGE;
  }

  const ref = firestore.doc(firestore.collection(db, kind === 'question' ? 'qa' : 'qaReplies'));
  const batch = firestore.writeBatch(db);
  const base = { text: data.text, uid: ctx.profile.uid, username: ctx.profile.username, createdAt: firestore.serverTimestamp() };
  if (kind === 'question') batch.set(ref, { ...base, up: 0, down: 0 });
  else batch.set(ref, { ...base, questionId: data.questionId });
  if (limited) batch.set(limitRef, limitRecord);

  try {
    await batch.commit();
    return '';
  } catch (e) {
    if (limited && e.code === 'permission-denied') {
      try {
        if (!nextLimit(await firestore.getDoc(limitRef), today, DAILY_POSTS)) return LIMIT_MESSAGE;
      } catch (_) { /* fall through */ }
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
    subtitle: hasDailyLimit(ctx) ? `You can post ${DAILY_POSTS} questions and replies per day.` : '',
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
            ${ctx.editorMode ? `<button class="trash-btn qa-trash" data-delete-question="${esc(q.id)}" title="Delete this question" aria-label="Delete this question">${ICON_TRASH}</button>` : ''}
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
                ${ctx.editorMode ? `<button class="trash-btn" data-delete-reply="${esc(r.id)}" title="Delete this reply" aria-label="Delete this reply">${ICON_TRASH}</button>` : ''}
              </li>`).join('')}</ul>` : ''}
            <form class="qa-reply-form" data-reply-form="${esc(q.id)}">
              <textarea rows="1" maxlength="${LIMIT}" placeholder="Write a reply" aria-label="Write a reply">${esc(drafts[q.id] || '')}</textarea>
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
      text.addEventListener('input', () => { drafts[id] = text.value; });
      text.addEventListener('focus', () => { focused = id; });
      text.addEventListener('blur', () => { if (focused === id) focused = null; });
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const value = text.value.trim();
        error.textContent = replyErrors[id] = checkText(value, 'reply');
        if (error.textContent) return;
        button.disabled = true;
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

    // Editor Mode
    list.querySelectorAll('[data-delete-question]').forEach((b) => b.addEventListener('click', () => {
      const q = questions.find((x) => x.id === b.dataset.deleteQuestion);
      deleteQuestion(ctx, q, repliesFor(q.id));
    }));
    list.querySelectorAll('[data-delete-reply]').forEach((b) => b.addEventListener('click', () => {
      deleteReply(ctx, replies.find((x) => x.id === b.dataset.deleteReply));
    }));
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
