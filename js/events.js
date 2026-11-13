// ============================================================
// Events section (Step 5)
//
// Events are saved in Firestore:
//   events/{eventId}   { title, body, createdAt }
//     title      the event's name
//     body       a few paragraphs (a blank line starts a new paragraph)
//     createdAt  when it was added (newest show at the top)
//
// In Editor Mode, editors add events by pasting in part of an email
// (first line = event name, the rest = details), and can delete them
// (with Undo). Placeholder events show while there are none.
// ============================================================
import { esc, formatDate, paragraphsHTML } from './util.js';
import { openModal, closeModal } from './modal.js';
import { showToast } from './toast.js';

const ICON_TRASH = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';

const ICON_EVENTS = '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h3"/>';

// How many events stay fully visible before older ones start to fade
const FULLY_VISIBLE = 4;
const FADE_STEP = 0.12;
const MIN_OPACITY = 0.4;

// Shown only while there are no events in Firestore
const DAY = 24 * 60 * 60 * 1000;
const PLACEHOLDER_EVENTS = [
  {
    title: 'Winter Club Fair',
    daysAgo: 1,
    body: 'Come explore more than 60 student clubs in the main gym during lunch. Club leaders will be at their tables with sign-up sheets, sample activities and free snacks.\n\nIf you lead a club and still need a table, email the ASB office by Friday.',
  },
  {
    title: 'Band and Orchestra Winter Concert',
    daysAgo: 3,
    body: 'The Bellevue High School bands and orchestras present their winter concert in the theater at 7 p.m.\n\nAdmission is free for students with ID. Doors open at 6:30.',
  },
  {
    title: 'Canned Food Drive',
    daysAgo: 6,
    body: 'Bring canned and boxed food to your second period class through the end of the month. The class that collects the most wins a pizza party.\n\nAll donations go to a local food bank.',
  },
  {
    title: 'Library Study Nights',
    daysAgo: 9,
    body: 'The library stays open until 7 p.m. on Tuesdays and Thursdays for finals study sessions. Peer tutors will be available for math and science.',
  },
  {
    title: 'Spirit Week Recap',
    daysAgo: 20,
    body: 'Thanks to everyone who dressed up for spirit week! The seniors took first place overall, with the juniors close behind.',
  },
  {
    title: 'Fall Picture Retakes',
    daysAgo: 30,
    body: 'Missed picture day? Retakes are in the library from 8 a.m. to noon. Bring your ID card.',
  },
];

function placeholders() {
  const now = Date.now();
  return PLACEHOLDER_EVENTS.map((e, i) => ({
    id: `sample-${i}`,
    title: e.title,
    body: e.body,
    createdAt: new Date(now - e.daysAgo * DAY),
    sample: true,
  }));
}

// First line of the body, for the preview under each title
function preview(body) {
  const text = String(body || '').replace(/\s+/g, ' ').trim();
  return text.length > 140 ? text.slice(0, 140).trim() + '…' : text;
}

function openEvent(event) {
  openModal({
    title: event.title,
    subtitle: `Added ${formatDate(event.createdAt)}`,
    html: paragraphsHTML(event.body),
  });
}

function draw(el, events, usingPlaceholders, ctx) {
  const editing = ctx.editorMode && !usingPlaceholders;
  const list = el.querySelector('#eventsList');
  list.innerHTML = events.map((event, i) => {
    const opacity = Math.max(MIN_OPACITY, 1 - Math.max(0, i - FULLY_VISIBLE + 1) * FADE_STEP);
    const added = event.createdAt;
    return `
      <li class="event-item" style="--fade:${opacity.toFixed(2)}">
        <button class="event-link" data-index="${i}">
          <span class="event-date">
            <span class="event-month">${esc(added.toLocaleDateString('en-US', { month: 'short' }))}</span>
            <span class="event-day">${added.getDate()}</span>
          </span>
          <span class="event-text">
            <span class="event-title">${esc(event.title)}</span>
            <span class="event-preview">${esc(preview(event.body))}</span>
          </span>
          <svg class="event-arrow" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
        </button>
        ${editing ? `<button class="trash-btn" data-delete="${i}" title="Delete this event" aria-label="Delete this event">${ICON_TRASH}</button>` : ''}
      </li>`;
  }).join('');

  list.querySelectorAll('.event-link').forEach((button) => {
    button.addEventListener('click', () => openEvent(events[Number(button.dataset.index)]));
  });
  list.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', () => deleteEvent(ctx, events[Number(button.dataset.delete)]));
  });

  el.querySelector('#eventsSampleNote').hidden = !usingPlaceholders;
}

// ---------- Editor tools ----------
// Splits pasted text: the first line is the name, the rest is the details.
export function parseEvent(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  const title = (lines.shift() || '').trim();
  const body = lines.join('\n').replace(/^\s*\n/, '').trim();
  return { title, body };
}

function openAddEvent(ctx) {
  const body = openModal({
    title: 'Add an event',
    html: `
      <p class="modal-hint">Paste a section of an email. The <strong>first line</strong> becomes the event name;
        everything after it is shown when the event is clicked. Leave a blank line between paragraphs.</p>
      <textarea class="paste-box" id="eventPaste" rows="10" placeholder="Winter Club Fair&#10;&#10;Come explore more than 60 clubs..."></textarea>
      <div class="paste-preview" id="eventPreview"></div>
      <p class="form-error" id="eventError" role="alert"></p>
      <button class="btn-primary" id="eventSave">Add Event</button>`,
  });

  const paste = body.querySelector('#eventPaste');
  const preview = body.querySelector('#eventPreview');
  paste.focus();
  paste.addEventListener('input', () => {
    body.querySelector('#eventError').textContent = '';
    const { title } = parseEvent(paste.value);
    preview.innerHTML = title ? `Event name: <strong>${esc(title.slice(0, 200))}</strong>` : '';
  });

  body.querySelector('#eventSave').addEventListener('click', async () => {
    const { title, body: details } = parseEvent(paste.value);
    const error = body.querySelector('#eventError');
    if (!title) { error.textContent = 'Paste the event first. Its first line is the name.'; return; }
    if (title.length > 200) { error.textContent = 'The first line (the event name) is too long. Keep it under 200 characters.'; return; }

    const { db, firestore } = ctx.fb;
    body.querySelector('#eventSave').disabled = true;
    try {
      await firestore.addDoc(firestore.collection(db, 'events'), {
        title,
        body: details,
        createdAt: firestore.serverTimestamp(),
      });
      closeModal();
      showToast(`Added "${title}".`);
    } catch (e) {
      error.textContent = `Couldn't add the event (${e.code || e.message}).`;
      body.querySelector('#eventSave').disabled = false;
    }
  });
}

async function deleteEvent(ctx, event) {
  const { db, firestore } = ctx.fb;
  const ref = firestore.doc(db, 'events', event.id);
  try {
    await firestore.deleteDoc(ref);
  } catch (e) {
    showToast(`Couldn't delete it (${e.code || e.message}).`);
    return;
  }
  // Undo puts it back exactly as it was (same name, details and date)
  showToast(`Deleted "${event.title}".`, {
    action: 'Undo',
    seconds: 8,
    onAction: () => firestore.setDoc(ref, {
      title: event.title,
      body: event.body,
      createdAt: firestore.Timestamp.fromDate(event.createdAt),
    }).catch((e) => showToast(`Couldn't undo (${e.code || e.message}).`)),
  });
}

export const eventsSection = {
  id: 'events',
  label: 'Events',
  icon: ICON_EVENTS,

  mount(el, param, ctx) {
    el.innerHTML = `
      <h2 class="page-title">Events</h2>
      <p class="code-note events-note" id="eventsSampleNote" hidden>These are placeholder events.
        Editors will be able to add real ones from the website in a later step.</p>
      <div class="section-head">
        <p class="events-intro">Newest at the top. Click an event for details; scroll down for past events.</p>
        ${ctx.editorMode ? '<button class="btn-add" id="addEventBtn">+ Add Event</button>' : ''}
      </div>
      <ul class="events-list" id="eventsList"><li class="placeholder">Loading events…</li></ul>
      <p class="form-error" id="eventsError" role="alert"></p>
    `;

    if (ctx.editorMode) el.querySelector('#addEventBtn').addEventListener('click', () => openAddEvent(ctx));

    const { db, firestore } = ctx.fb;
    const newestFirst = firestore.query(firestore.collection(db, 'events'), firestore.orderBy('createdAt', 'desc'));

    // Live: new events appear without reloading
    return firestore.onSnapshot(newestFirst, (snapshot) => {
      const events = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || 'Untitled event',
          body: data.body || '',
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
        };
      });
      if (events.length) draw(el, events, false, ctx);
      else draw(el, placeholders(), true, ctx);
    }, (error) => {
      draw(el, placeholders(), true, ctx);
      el.querySelector('#eventsError').textContent =
        `Couldn't load events (${error.code || error.message}). Showing placeholders.`;
    });
  },
};
