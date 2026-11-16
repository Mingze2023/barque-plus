// ============================================================
// Student Art section (Step 7)
//
// Each piece fills the whole page; scrolling slides to the next one,
// newest first. The ••• button shows the piece's background text.
//
// Saved in Firestore:
//   art/{id}        { type, title, artist, description, text, link, hasImage, createdAt }
//                     type: 'image' | 'text' | 'video' | 'audio'
//                     text: the writing (text pieces)
//                     link: a video/audio link (see js/embeds.js)
//   artImages/{id}  { data }   the picture, shrunk to fit (see js/images.js).
//                   Kept separate so pictures only load when you scroll near them.
//
// Editor Mode: "+ Add Art", and edit (title, artist, description) or
// delete (with Undo) on each piece.
// ============================================================
import { esc, formatDate, paragraphsHTML } from './util.js';
import { openModal, closeModal } from './modal.js';
import { showToast } from './toast.js';
import { shrinkImage, describeSize } from './images.js';
import { readMediaLink } from './embeds.js';

const ICON_ART = '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-1.2-1-1.4-1-2.4 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4.1-4-7.4-9-7.4z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7.3" r="1.2"/><circle cx="15" cy="7.8" r="1.2"/>';
const ICON_TRASH = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';
const ICON_PENCIL = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M10 8.5l6 3.5-6 3.5z"/></svg>';
const ICON_NOTE = '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>';

const TYPES = {
  image: 'Picture',
  text: 'Text',
  video: 'Video',
  audio: 'Audio',
};

// ---------- Placeholders (shown while there are no pieces) ----------
const SAMPLE_PICTURE = 'data:image/svg+xml,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#f7c873"/></linearGradient></defs>
  <rect width="800" height="560" fill="url(#sky)"/>
  <circle cx="560" cy="200" r="90" fill="#f2b705"/>
  <circle cx="560" cy="200" r="130" fill="none" stroke="#f2b705" stroke-width="6" opacity=".35"/>
  <path d="M0 380 C140 300 260 330 380 370 S640 300 800 340 V560 H0z" fill="#c9ad8c"/>
  <path d="M0 440 C160 390 300 430 440 450 S680 400 800 430 V560 H0z" fill="#7a5230"/>
  <path d="M0 500 C200 470 380 500 560 510 S740 480 800 490 V560 H0z" fill="#3a2414"/>
  <g fill="none" stroke="#1f9e8f" stroke-width="5" stroke-linecap="round"><path d="M120 150 q20 -16 40 0 q20 -16 40 0"/><path d="M240 110 q14 -11 28 0 q14 -11 28 0"/></g>
</svg>`);

const SAMPLE_POEM = `First Bell

The hallway hums before the bell,
a river of backpacks, half-asleep,
someone laughing three lockers down,
a promise made that no one will keep.

By second period the sun is up,
gold through the windows, slow and wide,
and every desk is a small boat
waiting for the turning of the tide.`;

function placeholders() {
  const now = Date.now();
  return [
    { id: 'sample-image', type: 'image', title: 'Sample Picture: Hills at Dawn', artist: 'Sample Artist',
      description: 'This is where a picture piece appears. Editors upload a picture from their computer; it is shrunk automatically so it loads quickly.\n\nThe ••• button shows background text like this: the story behind the piece, the materials used, or a note from the artist.',
      createdAt: new Date(now - 1 * 86400000), sample: true, sampleImage: SAMPLE_PICTURE },
    { id: 'sample-text', type: 'text', title: 'Sample Writing: First Bell', artist: 'Sample Writer', text: SAMPLE_POEM,
      description: 'Text pieces are for poems, short stories and essays. Long pieces scroll inside the page.',
      createdAt: new Date(now - 2 * 86400000), sample: true },
    { id: 'sample-video', type: 'video', title: 'Sample Video', artist: 'Sample Filmmaker',
      description: 'Video pieces play from a link: YouTube, Vimeo, Google Drive, or a direct video file.',
      createdAt: new Date(now - 3 * 86400000), sample: true },
    { id: 'sample-audio', type: 'audio', title: 'Sample Audio', artist: 'Sample Musician',
      description: 'Audio pieces play from a link: SoundCloud, YouTube, Google Drive, or a direct audio file (like an .mp3).',
      createdAt: new Date(now - 4 * 86400000), sample: true },
  ];
}

// Pictures already downloaded this visit (so redrawing doesn't download them again)
const pictureCache = new Map();

// ---------- Drawing one piece ----------
function frameHTML(piece) {
  if (piece.type === 'image') {
    if (piece.sampleImage) return `<img class="art-image" src="${piece.sampleImage}" alt="${esc(piece.title)}">`;
    if (pictureCache.has(piece.id)) return `<img class="art-image" src="${pictureCache.get(piece.id)}" alt="${esc(piece.title)}">`;
    return `<div class="art-loading" data-image="${esc(piece.id)}">Loading picture…</div>`;
  }
  if (piece.type === 'text') {
    return `<div class="art-text"><div class="art-text-inner">${paragraphsHTML(piece.text)}</div></div>`;
  }
  // video / audio
  if (piece.sample) {
    return `<div class="art-media-sample">${piece.type === 'video' ? ICON_PLAY : ICON_NOTE}
      <span>${piece.type === 'video' ? 'A video plays here' : 'Audio plays here'}</span></div>`;
  }
  const player = readMediaLink(piece.link);
  if (!player.ok) return `<div class="art-media-sample">${ICON_PLAY}<span>This link can't be played.</span></div>`;
  if (player.kind === 'video') return `<video class="art-video" src="${esc(player.src)}" controls preload="metadata"></video>`;
  if (player.kind === 'audio') {
    return `<div class="art-audio">${ICON_NOTE}<audio src="${esc(player.src)}" controls preload="metadata"></audio></div>`;
  }
  const tall = piece.type === 'audio' && player.site === 'SoundCloud';
  return `<div class="art-embed${tall ? ' tall' : ''}"><iframe src="${esc(player.src)}" title="${esc(piece.title)}"
    allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>`;
}

function cardHTML(piece, index, editing) {
  return `
    <section class="art-card type-${piece.type}" data-index="${index}">
      <div class="art-frame">${frameHTML(piece)}</div>
      <div class="art-description" hidden>
        <h3>About this piece</h3>
        ${paragraphsHTML(piece.description) || '<p><em>No background text yet.</em></p>'}
      </div>
      <div class="art-info">
        <div class="art-caption">
          <span class="art-type">${TYPES[piece.type]}</span>
          <h3 class="art-title">${esc(piece.title)}</h3>
          <div class="art-meta">${esc(piece.artist)} · ${esc(formatDate(piece.createdAt))}</div>
        </div>
        ${editing ? `
          <button class="edit-btn" data-edit="${index}" title="Edit this piece" aria-label="Edit this piece">${ICON_PENCIL}</button>
          <button class="trash-btn" data-delete="${index}" title="Delete this piece" aria-label="Delete this piece">${ICON_TRASH}</button>` : ''}
        <button class="art-more" data-more="${index}" aria-expanded="false" title="About this piece" aria-label="About this piece">
          <span></span><span></span><span></span>
        </button>
      </div>
    </section>`;
}

// ---------- Loading pictures only when you scroll near them ----------
function watchImages(stage, ctx) {
  const { db, firestore } = ctx.fb;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(async (entry) => {
      if (!entry.isIntersecting) return;
      const holder = entry.target;
      observer.unobserve(holder);
      try {
        const snap = await firestore.getDoc(firestore.doc(db, 'artImages', holder.dataset.image));
        if (!snap.exists()) { holder.textContent = 'Picture missing.'; return; }
        pictureCache.set(holder.dataset.image, snap.data().data);
        const img = document.createElement('img');
        img.className = 'art-image';
        img.src = snap.data().data;
        img.alt = holder.closest('.art-card').querySelector('.art-title').textContent;
        holder.replaceWith(img);
      } catch (e) {
        holder.textContent = `Couldn't load the picture (${e.code || e.message}).`;
      }
    });
  }, { root: stage, rootMargin: '100% 0px' });   // starts loading one page early
  stage.querySelectorAll('[data-image]').forEach((el) => observer.observe(el));
  return observer;
}

// Highlights the piece on screen and its dot on the right
function watchActive(stage, dots) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle('active', entry.isIntersecting);
      if (entry.isIntersecting) {
        dots.querySelectorAll('button').forEach((d) => d.classList.toggle('active', d.dataset.go === entry.target.dataset.index));
      }
    });
  }, { root: stage, threshold: 0.55 });
  stage.querySelectorAll('.art-card').forEach((card) => observer.observe(card));
  return observer;
}

// The stage fills the rest of the window
function fitStage(stage) {
  const main = document.querySelector('.main');
  const top = stage.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
  stage.style.height = `${Math.max(420, main.clientHeight - top - 24)}px`;
}

// ---------- Editor tools ----------
function openArtEditor(ctx, existing = null) {
  const editing = !!existing;
  const body = openModal({
    title: editing ? 'Edit art piece' : 'Add an art piece',
    html: `
      ${editing ? '' : `
        <div class="type-choice" role="radiogroup" aria-label="Type of art">
          ${Object.entries(TYPES).map(([key, label]) => `<button type="button" class="type-option" data-type="${key}" role="radio">${label}</button>`).join('')}
        </div>
        <div class="type-panel" data-for="image" hidden>
          <label class="field modal-field"><span>Picture (JPG, PNG, GIF or WebP)</span>
            <input type="file" id="artFile" accept="image/jpeg,image/png,image/gif,image/webp"></label>
          <div class="paste-preview" id="artFileNote"></div>
          <img class="art-upload-preview" id="artPreview" alt="" hidden>
        </div>
        <div class="type-panel" data-for="text" hidden>
          <label class="field modal-field"><span>The writing (leave a blank line between paragraphs)</span>
            <textarea class="paste-box" id="artText" rows="8" maxlength="20000"></textarea></label>
        </div>
        <div class="type-panel" data-for="media" hidden>
          <label class="field modal-field"><span id="artLinkLabel">Link</span>
            <input type="text" id="artLink" placeholder="https://www.youtube.com/watch?v=..." autocomplete="off"></label>
          <div class="paste-preview" id="artLinkNote"></div>
        </div>`}
      <label class="field modal-field"><span>Title</span><input type="text" id="artTitle" maxlength="200" autocomplete="off"></label>
      <label class="field modal-field"><span>Artist</span><input type="text" id="artArtist" maxlength="100" autocomplete="off"></label>
      <label class="field modal-field"><span>Background text (shown with •••)</span>
        <textarea class="paste-box" id="artDescription" rows="4" maxlength="5000"></textarea></label>
      <p class="form-error" id="artError" role="alert"></p>
      <button class="btn-primary" id="artSave">${editing ? 'Save Changes' : 'Add Art'}</button>`,
  });

  const $ = (sel) => body.querySelector(sel);
  const error = $('#artError');
  let type = existing ? existing.type : null;
  let pictureData = null;

  if (editing) {
    $('#artTitle').value = existing.title;
    $('#artArtist').value = existing.artist;
    $('#artDescription').value = existing.description || '';
  } else {
    // Choosing the type shows the matching box
    body.querySelectorAll('.type-option').forEach((button) => {
      button.addEventListener('click', () => {
        type = button.dataset.type;
        error.textContent = '';
        body.querySelectorAll('.type-option').forEach((b) => b.classList.toggle('selected', b === button));
        body.querySelectorAll('.type-panel').forEach((panel) => {
          panel.hidden = panel.dataset.for !== (type === 'video' || type === 'audio' ? 'media' : type);
        });
        $('#artLinkLabel').textContent = type === 'audio'
          ? 'Audio link (SoundCloud, YouTube, Google Drive, or an .mp3 file)'
          : 'Video link (YouTube, Vimeo, Google Drive, or an .mp4 file)';
      });
    });

    $('#artFile').addEventListener('change', async () => {
      const file = $('#artFile').files[0];
      const note = $('#artFileNote');
      pictureData = null;
      $('#artPreview').hidden = true;
      note.classList.remove('bad');
      if (!file) { note.textContent = ''; return; }
      note.textContent = 'Shrinking the picture…';
      try {
        pictureData = await shrinkImage(file);
        $('#artPreview').src = pictureData;
        $('#artPreview').hidden = false;
        note.textContent = `Ready (${describeSize(pictureData)}).`;
        if (!$('#artTitle').value) $('#artTitle').value = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      } catch (e) {
        note.textContent = e.message;
        note.classList.add('bad');
      }
    });

    $('#artLink').addEventListener('input', () => {
      const value = $('#artLink').value.trim();
      const note = $('#artLinkNote');
      if (!value) { note.textContent = ''; note.classList.remove('bad'); return; }
      const player = readMediaLink(value);
      note.textContent = player.ok ? `Plays from ${player.site}.` : player.error;
      note.classList.toggle('bad', !player.ok);
    });
  }

  $(editing ? '#artTitle' : '.type-option').focus();

  $('#artSave').addEventListener('click', async () => {
    error.textContent = '';
    const title = $('#artTitle').value.trim();
    const artist = $('#artArtist').value.trim();
    const description = $('#artDescription').value.trim();

    if (!type) { error.textContent = 'Choose Picture, Text, Video or Audio first.'; return; }
    if (!editing) {
      if (type === 'image' && !pictureData) { error.textContent = 'Choose a picture (and wait for "Ready").'; return; }
      if (type === 'text' && !$('#artText').value.trim()) { error.textContent = 'Type or paste the writing.'; return; }
      if ((type === 'video' || type === 'audio')) {
        const player = readMediaLink($('#artLink').value);
        if (!player.ok) { error.textContent = player.error; return; }
      }
    }
    if (!title) { error.textContent = 'Give the piece a title.'; return; }
    if (!artist) { error.textContent = 'Type the artist\'s name.'; return; }

    const { db, firestore } = ctx.fb;
    $('#artSave').disabled = true;
    try {
      if (editing) {
        await firestore.updateDoc(firestore.doc(db, 'art', existing.id), { title, artist, description });
        closeModal();
        showToast(`Saved "${title}".`);
        return;
      }

      const ref = firestore.doc(firestore.collection(db, 'art'));   // a new, empty spot with its own ID
      const piece = { type, title, artist, description, createdAt: firestore.serverTimestamp() };
      if (type === 'text') piece.text = $('#artText').value.trim();
      if (type === 'video' || type === 'audio') piece.link = $('#artLink').value.trim();
      if (type === 'image') piece.hasImage = true;

      const batch = firestore.writeBatch(db);   // the piece and its picture are saved together
      batch.set(ref, piece);
      if (type === 'image') batch.set(firestore.doc(db, 'artImages', ref.id), { data: pictureData });
      await batch.commit();
      closeModal();
      showToast(`Added "${title}".`);
    } catch (e) {
      error.textContent = `Couldn't save it (${e.code || e.message}).`;
      $('#artSave').disabled = false;
    }
  });
}

async function deleteArt(ctx, piece) {
  const { db, firestore } = ctx.fb;
  const pieceRef = firestore.doc(db, 'art', piece.id);
  const imageRef = firestore.doc(db, 'artImages', piece.id);

  // Keep a copy for Undo (including the picture)
  let picture = null;
  try {
    if (piece.type === 'image') {
      const snap = await firestore.getDoc(imageRef);
      if (snap.exists()) picture = snap.data().data;
    }
    const batch = firestore.writeBatch(db);
    batch.delete(pieceRef);
    if (piece.type === 'image') batch.delete(imageRef);
    await batch.commit();
  } catch (e) {
    showToast(`Couldn't delete it (${e.code || e.message}).`);
    return;
  }

  showToast(`Deleted "${piece.title}".`, {
    action: 'Undo',
    seconds: 8,
    onAction: async () => {
      const saved = { type: piece.type, title: piece.title, artist: piece.artist, description: piece.description || '',
        createdAt: firestore.Timestamp.fromDate(piece.createdAt) };
      if (piece.text !== undefined) saved.text = piece.text;
      if (piece.link !== undefined) saved.link = piece.link;
      if (piece.type === 'image') saved.hasImage = true;
      const batch = firestore.writeBatch(db);
      batch.set(pieceRef, saved);
      if (picture) batch.set(imageRef, { data: picture });
      try { await batch.commit(); } catch (e) { showToast(`Couldn't undo (${e.code || e.message}).`); }
    },
  });
}

// ---------- The section ----------
export const artSection = {
  id: 'art',
  label: 'Student Art',
  icon: ICON_ART,

  mount(el, param, ctx) {
    el.innerHTML = `
      <h2 class="page-title">Student Art</h2>
      <div class="section-head art-head">
        <p class="events-intro" id="artIntro">Scroll to move from piece to piece. Click ••• to read about a piece.</p>
        ${ctx.editorMode ? '<button class="btn-add" id="addArtBtn">+ Add Art</button>' : ''}
      </div>
      <div class="art-wrap">
        <div class="art-stage" id="artStage" tabindex="0" aria-label="Student art, one piece at a time"></div>
        <div class="art-dots" id="artDots"></div>
      </div>
      <p class="form-error" id="artLoadError" role="alert"></p>
    `;
    if (ctx.editorMode) el.querySelector('#addArtBtn').addEventListener('click', () => openArtEditor(ctx));

    const stage = el.querySelector('#artStage');
    const dots = el.querySelector('#artDots');
    fitStage(stage);
    const onResize = () => fitStage(stage);
    window.addEventListener('resize', onResize);

    let observers = [];
    let pieces = [];

    function draw(list, usingPlaceholders) {
      observers.forEach((o) => o.disconnect());
      pieces = list;
      const editing = ctx.editorMode && !usingPlaceholders;
      stage.innerHTML = list.map((p, i) => cardHTML(p, i, editing)).join('');
      dots.innerHTML = list.map((p, i) => `<button data-go="${i}" title="${esc(p.title)}" aria-label="Go to ${esc(p.title)}"></button>`).join('');
      el.querySelector('#artIntro').textContent = usingPlaceholders
        ? (ctx.editorMode
          ? 'These are placeholder pieces, one of each kind. They aren\'t saved, so they can\'t be edited; they disappear when you add real art.'
          : 'These are placeholder pieces. Real student art appears here once editors add it.')
        : 'Scroll to move from piece to piece. Click ••• to read about a piece.';

      stage.querySelectorAll('[data-more]').forEach((button) => button.addEventListener('click', () => {
        const card = button.closest('.art-card');
        const panel = card.querySelector('.art-description');
        const open = panel.hidden;
        panel.hidden = !open;
        card.classList.toggle('show-description', open);
        button.setAttribute('aria-expanded', String(open));
      }));
      stage.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openArtEditor(ctx, pieces[Number(b.dataset.edit)])));
      stage.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', () => deleteArt(ctx, pieces[Number(b.dataset.delete)])));
      dots.querySelectorAll('button').forEach((d) => d.addEventListener('click', () => {
        stage.querySelector(`.art-card[data-index="${d.dataset.go}"]`).scrollIntoView({ behavior: 'smooth', block: 'start' });
      }));

      observers = [watchActive(stage, dots), watchImages(stage, ctx)];
    }

    const { db, firestore } = ctx.fb;
    const newestFirst = firestore.query(firestore.collection(db, 'art'), firestore.orderBy('createdAt', 'desc'));
    const stop = firestore.onSnapshot(newestFirst, (snapshot) => {
      const list = snapshot.docs.map((doc) => {
        const d = doc.data();
        return { id: doc.id, type: d.type, title: d.title, artist: d.artist, description: d.description || '',
          text: d.text, link: d.link, createdAt: d.createdAt ? d.createdAt.toDate() : new Date() };
      }).filter((p) => TYPES[p.type]);
      if (list.length) draw(list, false);
      else draw(placeholders(), true);
    }, (error) => {
      draw(placeholders(), true);
      el.querySelector('#artLoadError').textContent = `Couldn't load art (${error.code || error.message}). Showing placeholders.`;
    });

    return () => {
      stop();
      observers.forEach((o) => o.disconnect());
      window.removeEventListener('resize', onResize);
    };
  },
};
