// ============================================================
// News section (Step 4)
//
// Articles come from data/news.json, which the scraper updates
// every day (scripts/scrape_news.py). Votes, views and comments
// are saved in Firestore:
//   articles/{articleId}                  { up, down, views }
//   articles/{articleId}/comments/{id}    { text, uid, username, createdAt }
//   users/{userId}/votes/{articleId}      { value: 1 or -1 }
// ============================================================

const COMMENT_LIMIT = 500;

// ---------- Shared state while logged in ----------
let news = null;            // { source, updated, articles: [...] }
let stats = {};             // articleId -> { up, down, views }
let myVotes = {};           // articleId -> 1 or -1
let unsubscribers = [];     // live listeners to stop when logging out
let listState = { search: '', sort: 'date' };

const ICON_NEWS = '<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M7 9h7M7 12h7M7 15h4"/>';
const ICON_UP = '<svg viewBox="0 0 24 24"><path d="M12 5l7 9H5z"/></svg>';
const ICON_DOWN = '<svg viewBox="0 0 24 24"><path d="M12 19l-7-9h14z"/></svg>';
const ICON_EYE = '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';

// ---------- Helpers ----------
// Makes text safe to put inside HTML (articles come from another website)
function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date)) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statsFor(id) {
  const s = stats[id] || {};
  return { up: s.up || 0, down: s.down || 0, views: s.views || 0 };
}

function score(id) {
  const s = statsFor(id);
  return s.up - s.down;
}

function isNew(article, ctx) {
  if (!ctx.profile.newSince) return false; // first visit: nothing to compare against
  const found = new Date(article.firstSeen || article.date);
  return found > ctx.profile.newSince;
}

async function loadNews() {
  if (news) return news;
  const response = await fetch('data/news.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('data/news.json not found');
  news = await response.json();
  return news;
}

// Live vote/view counts and the user's own votes
function startListening(ctx) {
  if (unsubscribers.length) return;
  const { db, firestore } = ctx.fb;

  unsubscribers.push(firestore.onSnapshot(firestore.collection(db, 'articles'), (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'removed') delete stats[change.doc.id];
      else stats[change.doc.id] = change.doc.data();
    });
    refreshCounts();
  }, (error) => console.error('Could not load vote counts:', error)));

  unsubscribers.push(firestore.onSnapshot(firestore.collection(db, 'users', ctx.profile.uid, 'votes'), (snapshot) => {
    myVotes = {};
    snapshot.forEach((doc) => { myVotes[doc.id] = doc.data().value; });
    refreshCounts();
  }, (error) => console.error('Could not load your votes:', error)));
}

// Updates every vote box and view count on the page without redrawing it
function refreshCounts() {
  document.querySelectorAll('[data-vote-box]').forEach((box) => {
    const id = box.dataset.voteBox;
    const s = statsFor(id);
    box.querySelector('.vote-score').textContent = s.up - s.down;
    box.querySelector('.vote-score').title = `${s.up} up, ${s.down} down`;
    box.querySelector('.vote-up').classList.toggle('voted', myVotes[id] === 1);
    box.querySelector('.vote-down').classList.toggle('voted', myVotes[id] === -1);
  });
  document.querySelectorAll('[data-views]').forEach((el) => {
    el.querySelector('span').textContent = statsFor(el.dataset.views).views;
  });
}

// ---------- Voting ----------
async function vote(ctx, id, clicked) {
  const { db, firestore } = ctx.fb;
  const before = myVotes[id] || 0;
  const after = before === clicked ? 0 : clicked;   // clicking the same arrow again removes the vote
  const upChange = (after === 1 ? 1 : 0) - (before === 1 ? 1 : 0);
  const downChange = (after === -1 ? 1 : 0) - (before === -1 ? 1 : 0);

  const voteRef = firestore.doc(db, 'users', ctx.profile.uid, 'votes', id);
  const statsRef = firestore.doc(db, 'articles', id);

  // Save the vote and the new counts together, so they always match
  const batch = firestore.writeBatch(db);
  if (after === 0) batch.delete(voteRef);
  else batch.set(voteRef, { value: after });
  batch.set(statsRef, {
    up: firestore.increment(upChange),
    down: firestore.increment(downChange),
  }, { merge: true });

  try {
    await batch.commit();
  } catch (error) {
    console.error('Vote failed:', error);
    alertInline(`Your vote couldn't be saved (${error.code || error.message}).`);
  }
}

function voteBoxHTML(id, horizontal = false) {
  return `
    <div class="vote-box${horizontal ? ' horizontal' : ''}" data-vote-box="${esc(id)}">
      <button class="vote-up" title="Upvote" aria-label="Upvote">${ICON_UP}</button>
      <span class="vote-score">0</span>
      <button class="vote-down" title="Downvote" aria-label="Downvote">${ICON_DOWN}</button>
    </div>`;
}

function hookVoteBoxes(container, ctx) {
  container.querySelectorAll('[data-vote-box]').forEach((box) => {
    const id = box.dataset.voteBox;
    box.querySelector('.vote-up').addEventListener('click', (e) => { e.preventDefault(); vote(ctx, id, 1); });
    box.querySelector('.vote-down').addEventListener('click', (e) => { e.preventDefault(); vote(ctx, id, -1); });
  });
}

// If an image can't load (e.g. blocked), show the B+ placeholder or hide it
function handleBrokenImages(container) {
  container.querySelectorAll('img').forEach((img) => {
    img.addEventListener('error', () => {
      const thumb = img.closest('.news-thumb');
      if (thumb) thumb.innerHTML = '<div class="news-thumb-empty">B<span>+</span></div>';
      else (img.closest('figure') || img).classList.add('image-failed');
    }, { once: true });
  });
}

function alertInline(message) {
  const box = document.getElementById('newsMessage');
  if (box) box.textContent = message;
}

// ---------- The list of articles ----------
function sortedAndFiltered() {
  const words = listState.search.toLowerCase().split(/\s+/).filter(Boolean);
  let list = news.articles.filter((a) => {
    const haystack = `${a.title} ${a.author} ${a.excerpt}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
  const byDate = (a, b) => new Date(b.date) - new Date(a.date);
  if (listState.sort === 'views') list.sort((a, b) => statsFor(b.id).views - statsFor(a.id).views || byDate(a, b));
  else if (listState.sort === 'votes') list.sort((a, b) => score(b.id) - score(a.id) || byDate(a, b));
  else list.sort(byDate);
  return list;
}

function cardHTML(article, ctx) {
  const thumb = article.image
    ? `<img src="${esc(article.image)}" alt="" loading="lazy">`
    : `<div class="news-thumb-empty">B<span>+</span></div>`;
  return `
    <article class="news-card">
      <a class="news-card-main" href="#news/${encodeURIComponent(article.id)}">
        <div class="news-thumb">${thumb}</div>
        <div class="news-info">
          <div class="news-meta">
            ${esc(article.author)} · ${esc(formatDate(article.date))}
            ${isNew(article, ctx) ? '<span class="new-label">New</span>' : ''}
          </div>
          <h3 class="news-title">${esc(article.title)}</h3>
          <p class="news-excerpt">${esc(article.excerpt)}</p>
          <div class="news-views" data-views="${esc(article.id)}">${ICON_EYE}<span>0</span></div>
        </div>
      </a>
      ${voteBoxHTML(article.id)}
    </article>`;
}

function drawList(el, ctx) {
  const list = sortedAndFiltered();
  const holder = el.querySelector('#newsList');
  holder.innerHTML = list.length
    ? list.map((a) => cardHTML(a, ctx)).join('')
    : `<div class="placeholder">No articles match “${esc(listState.search)}”.</div>`;
  hookVoteBoxes(holder, ctx);
  handleBrokenImages(holder);
  refreshCounts();
}

function mountList(el, ctx) {
  const sample = news.source === 'sample';
  el.innerHTML = `
    <h2 class="page-title">News</h2>
    ${sample ? `<p class="code-note news-sample-note">These are sample articles. Real Barque articles appear after the
      scraper runs (GitHub: Actions tab → “Scrape news and publish site” → Run workflow).</p>` : ''}
    <div class="news-toolbar">
      <label class="news-search">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
        <input type="search" id="newsSearch" placeholder="Search articles" value="${esc(listState.search)}">
      </label>
      <label class="news-sort">
        Sort by
        <select id="newsSort">
          <option value="date">Date published</option>
          <option value="views">Views</option>
          <option value="votes">Upvotes</option>
        </select>
      </label>
    </div>
    <p class="form-error" id="newsMessage" role="alert"></p>
    <div class="news-list" id="newsList"></div>
  `;
  el.querySelector('#newsSort').value = listState.sort;
  el.querySelector('#newsSearch').addEventListener('input', (e) => { listState.search = e.target.value; drawList(el, ctx); });
  el.querySelector('#newsSort').addEventListener('change', (e) => { listState.sort = e.target.value; drawList(el, ctx); });
  drawList(el, ctx);
}

// ---------- One article ----------
function bodyHTML(article) {
  return (article.body || []).map((block) => {
    if (block.type === 'heading') return `<h3>${esc(block.text)}</h3>`;
    if (block.type === 'quote') return `<blockquote>${esc(block.text)}</blockquote>`;
    if (block.type === 'image') {
      return `<figure><img src="${esc(block.src)}" alt="${esc(block.caption || '')}" loading="lazy">
        ${block.caption ? `<figcaption>${esc(block.caption)}</figcaption>` : ''}</figure>`;
    }
    return `<p>${esc(block.text)}</p>`;
  }).join('');
}

function mountArticle(el, article, ctx) {
  const { db, firestore } = ctx.fb;
  const hasImageInBody = (article.body || []).some((b) => b.type === 'image' && b.src === article.image);

  el.innerHTML = `
    <a class="back-link" href="#news">← All news</a>
    <article class="article">
      <h1 class="article-title">${esc(article.title)}</h1>
      <div class="article-meta">
        <span>${esc(article.author)} · ${esc(formatDate(article.date))}</span>
        <span class="news-views" data-views="${esc(article.id)}">${ICON_EYE}<span>0</span></span>
        ${voteBoxHTML(article.id, true)}
      </div>
      ${article.image && !hasImageInBody ? `<figure class="article-cover"><img src="${esc(article.image)}" alt=""></figure>` : ''}
      <div class="article-body">${bodyHTML(article)}</div>
      ${article.sample ? '' : `<a class="article-source" href="${esc(article.url)}" target="_blank" rel="noopener">Read on the Barque's website ↗</a>`}
    </article>

    <section class="comments">
      <h3 class="comments-title">Comments <span id="commentCount"></span></h3>
      <form class="comment-form" id="commentForm">
        <textarea id="commentText" maxlength="${COMMENT_LIMIT}" rows="3" placeholder="Add a comment"></textarea>
        <div class="comment-form-row">
          <span class="comment-counter" id="commentCounter">0 / ${COMMENT_LIMIT}</span>
          <button type="submit" class="btn-primary comment-post" id="commentPost">Post</button>
        </div>
        <p class="form-error" id="commentError" role="alert"></p>
      </form>
      <ul class="comment-list" id="commentList"></ul>
    </section>
    <p class="form-error" id="newsMessage" role="alert"></p>
  `;
  hookVoteBoxes(el, ctx);
  handleBrokenImages(el);
  refreshCounts();
  el.scrollIntoView?.({ block: 'start' });

  // Count a view each time the article is opened
  firestore.setDoc(firestore.doc(db, 'articles', article.id), { views: firestore.increment(1) }, { merge: true })
    .catch((error) => console.error('Could not count the view:', error));

  // ----- Comments -----
  const text = el.querySelector('#commentText');
  const counter = el.querySelector('#commentCounter');
  text.addEventListener('input', () => {
    counter.textContent = `${text.value.length} / ${COMMENT_LIMIT}`;
    counter.classList.toggle('full', text.value.length >= COMMENT_LIMIT);
  });

  const commentsRef = firestore.collection(db, 'articles', article.id, 'comments');
  el.querySelector('#commentForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = text.value.trim();
    const error = el.querySelector('#commentError');
    error.textContent = '';
    if (!message) { error.textContent = 'Type a comment first.'; return; }
    if (message.length > COMMENT_LIMIT) { error.textContent = `Comments can be at most ${COMMENT_LIMIT} characters.`; return; }

    el.querySelector('#commentPost').disabled = true;
    try {
      await firestore.addDoc(commentsRef, {
        text: message,
        uid: ctx.profile.uid,
        username: ctx.profile.username,
        createdAt: firestore.serverTimestamp(),
      });
      text.value = '';
      counter.textContent = `0 / ${COMMENT_LIMIT}`;
    } catch (e) {
      error.textContent = `Your comment couldn't be posted (${e.code || e.message}).`;
    }
    el.querySelector('#commentPost').disabled = false;
  });

  const newestFirst = firestore.query(commentsRef, firestore.orderBy('createdAt', 'desc'));
  const stop = firestore.onSnapshot(newestFirst, (snapshot) => {
    el.querySelector('#commentCount').textContent = `(${snapshot.size})`;
    const list = el.querySelector('#commentList');
    list.innerHTML = snapshot.empty
      ? '<li class="comment-empty">No comments yet. Be the first!</li>'
      : snapshot.docs.map((doc) => {
          const c = doc.data();
          const when = c.createdAt ? c.createdAt.toDate() : new Date();
          return `<li class="comment">
            <div class="comment-head"><strong>${esc(c.username)}</strong> · ${esc(formatDate(when))}</div>
            <p class="comment-text">${esc(c.text)}</p>
          </li>`;
        }).join('');
  }, (error) => {
    el.querySelector('#commentList').innerHTML = `<li class="comment-empty">Comments couldn't load (${esc(error.code || error.message)}).</li>`;
  });

  return stop; // stops listening for comments when leaving this article
}

// ---------- The section ----------
export const newsSection = {
  id: 'news',
  label: 'News',
  icon: ICON_NEWS,

  // el: where to draw. param: an article id from the address (#news/<id>), or nothing.
  // Returns a function to clean up when leaving, or nothing.
  mount(el, param, ctx) {
    el.innerHTML = '<h2 class="page-title">News</h2><div class="placeholder">Loading articles…</div>';
    startListening(ctx);

    let cleanup = null;
    let left = false;
    loadNews().then(() => {
      if (left) return;
      if (param) {
        const article = news.articles.find((a) => a.id === param);
        if (!article) {
          el.innerHTML = '<a class="back-link" href="#news">← All news</a><div class="placeholder">That article wasn\'t found.</div>';
          return;
        }
        cleanup = mountArticle(el, article, ctx);
      } else {
        mountList(el, ctx);
      }
    }).catch(() => {
      el.innerHTML = `<h2 class="page-title">News</h2>
        <div class="placeholder">No news yet. Run the scraper on GitHub: Actions tab → “Scrape news and publish site” → Run workflow.</div>`;
    });

    return () => { left = true; if (cleanup) cleanup(); };
  },

  // Called when logging out
  reset() {
    unsubscribers.forEach((stop) => stop());
    unsubscribers = [];
    stats = {};
    myVotes = {};
  },
};
