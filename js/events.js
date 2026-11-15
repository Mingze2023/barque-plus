// ============================================================
// Events section (Step 5, with dates added later)
//
// Events are saved in Firestore:
//   events/{eventId} {
//     title      the event's name
//     body       a few paragraphs (a blank line starts a new paragraph)
//     start      when it starts      (timestamp)
//     end        when it ends        (timestamp)
//     dateKind   'day' | 'range' | 'until' | 'month'  (see js/event-dates.js)
//     dateText   the date exactly as the editor typed it, e.g. "11/14-11/20"
//     createdAt  when it was added
//   }
//
// Order: upcoming and current events first (soonest at the top),
// then past events (most recent first), fading as they get older.
//
// In Editor Mode, editors add events by pasting in part of an email
// (first line = event name, the rest = details) plus a date, and can
// edit or delete them (with Undo). Placeholder events show while
// there are none.
// ============================================================
import { esc, paragraphsHTML } from './util.js';
import { openModal, closeModal } from './modal.js';
import { showToast } from './toast.js';
import { parseEventDate, describeEventDate, badgeParts, isPast } from './event-dates.js';

const ICON_EVENTS = '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h3"/>';
const ICON_TRASH = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';
const ICON_PENCIL = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';

// Past events fade: the first one is slightly faded, each older one more
const PAST_START_OPACITY = 0.8;
const FADE_STEP = 0.1;
const MIN_OPACITY = 0.35;

// ---------- Placeholders (shown only while there are no events) ----------
const PLACEHOLDER_EVENTS = [
  { title: 'Winter Club Fair', date: (t) => `${t.m(3)}`,
    body: 'Come explore more than 60 student clubs in the main gym during lunch. Club leaders will be at their tables with sign-up sheets, sample activities and free snacks.\n\nIf you lead a club and still need a table, email the ASB office by Friday.' },
  { title: 'Canned Food Drive', date: (t) => `now-${t.m(16)}`,
    body: 'Bring canned and boxed food to your second period class. The class that collects the most wins a pizza party.\n\nAll donations go to a local food bank.' },
  { title: 'Band and Orchestra Winter Concert', date: (t) => `${t.m(10)}`,
    body: 'The Bellevue High School bands and orchestras present their winter concert in the theater at 7 p.m.\n\nAdmission is free for students with ID. Doors open at 6:30.' },
  { title: 'Finals Study Nights', date: (t) => `${t.m(20)}-${t.m(24)}`,
    body: 'The library stays open until 7 p.m. for finals study sessions. Peer tutors will be available for math and science.' },
  { title: 'Spring Musical Auditions', date: (t) => t.monthName(3),
    body: 'Auditions for the spring musical will be held in the theater. Exact dates will be announced soon.' },
  { title: 'Spirit Week', date: (t) => `${t.m(-20)}-${t.m(-16)}`,
    body: 'Thanks to everyone who dressed up for spirit week! The seniors took first place overall, with the juniors close behind.' },
  { title: 'Fall Picture Retakes', date: (t) => `${t.m(-30)}`,
    body: 'Missed picture day? Retakes are in the library from 8 a.m. to noon. Bring your ID card.' },
];

function placeholders() {
  const now = new Date();
  const helpers = {
    m: (days) => { const d = new Date(now.getTime() + days * 86400000); return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`; },
    monthName: (months) => new Date(now.getFullYear(), now.getMonth() + months, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  };
  return PLACEHOLDER_EVENTS.map((e, i) => {
    const date = parseEventDate(e.date(helpers), now);
    return { id: `sample-${i}`, title: e.title, body: e.body, ...date, dateText: date.text, createdAt: now, sample: true };
  });
}

// ---------- Reading events from Firestore ----------
function fromDoc(doc) {
  const data = doc.data();
  const createdAt = data.createdAt ? data.createdAt.toDate() : new Date();
  // Events added before dates existed: use the day they were added
  const start = data.start ? data.start.toDate() : new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate());
  const end = data.end ? data.end.toDate() : new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
  return {
    id: doc.id,
    title: data.title || 'Untitled event',
    body: data.body || '',
    start, end,
    kind: data.dateKind || 'day',
    dateText: data.dateText || '',
    createdAt,
    noDate: !data.start,
  };
}

// Upcoming first (soonest at the top), then past (most recent first)
function arrange(events) {
  const now = new Date();
  const upcoming = events.filter((e) => !isPast(e, now))
    .sort((a, b) => a.start - b.start || a.end - b.end || b.createdAt - a.createdAt);
  const past = events.filter((e) => isPast(e, now))
    .sort((a, b) => b.end - a.end || b.start - a.start);
  return { upcoming, past };
}

// First line of the body, for the preview under each title
function preview(body) {
  const text = String(body || '').replace(/\s+/g, ' ').trim();
  return text.length > 140 ? text.slice(0, 140).trim() + '…' : text;
}

function openEvent(event) {
  openModal({
    title: event.title,
    subtitle: describeEventDate(event),
    html: paragraphsHTML(event.body) || '<p><em>No details yet.</em></p>',
  });
}

// ---------- Drawing the list ----------
function itemHTML(event, index, opacity, editing) {
  const badge = badgeParts(event);
  return `
    <li class="event-item" style="--fade:${opacity.toFixed(2)}">
      <button class="event-link" data-open="${index}">
        <span class="event-date${badge.small ? ' small' : ''}">
          <span class="event-month">${esc(badge.top)}</span>
          <span class="event-day">${esc(badge.bottom)}</span>
        </span>
        <span class="event-text">
          <span class="event-title">${esc(event.title)}</span>
          <span class="event-when">${esc(describeEventDate(event))}${editing && event.noDate ? ' <em class="needs-date">(no date set yet)</em>' : ''}</span>
          <span class="event-preview">${esc(preview(event.body))}</span>
        </span>
        <svg class="event-arrow" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
      </button>
      ${editing ? `
        <button class="edit-btn" data-edit="${index}" title="Edit this event" aria-label="Edit this event">${ICON_PENCIL}</button>
        <button class="trash-btn" data-delete="${index}" title="Delete this event" aria-label="Delete this event">${ICON_TRASH}</button>` : ''}
    </li>`;
}

function draw(el, events, usingPlaceholders, ctx) {
  const editing = ctx.editorMode && !usingPlaceholders;
  const { upcoming, past } = arrange(events);
  const ordered = [...upcoming, ...past];

  let html = upcoming.length
    ? upcoming.map((e, i) => itemHTML(e, i, 1, editing)).join('')
    : '<li class="events-empty">No upcoming events right now.</li>';
  if (past.length) {
    html += '<li class="events-divider"><span>Past events</span></li>';
    html += past.map((e, i) => {
      const opacity = Math.max(MIN_OPACITY, PAST_START_OPACITY - i * FADE_STEP);
      return itemHTML(e, upcoming.length + i, opacity, editing);
    }).join('');
  }

  const list = el.querySelector('#eventsList');
  list.innerHTML = html;
  list.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openEvent(ordered[Number(b.dataset.open)])));
  list.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openEventEditor(ctx, ordered[Number(b.dataset.edit)])));
  list.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', () => deleteEvent(ctx, ordered[Number(b.dataset.delete)])));

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

// The data saved for an event (createdAt is added separately)
function eventData(title, body, date, firestore) {
  return {
    title,
    body,
    start: firestore.Timestamp.fromDate(date.start),
    end: firestore.Timestamp.fromDate(date.end),
    dateKind: date.kind,
    dateText: date.text,
  };
}

// The Add / Edit popup. Pass an event to edit it, or nothing to add a new one.
function openEventEditor(ctx, existing = null) {
  const body = openModal({
    title: existing ? 'Edit event' : 'Add an event',
    html: `
      <label class="field modal-field">
        <span>Date</span>
        <input type="text" id="eventDate" placeholder="11/20, 11/14-11/20, now-11/20, or November" autocomplete="off">
      </label>
      <div class="paste-preview" id="datePreview"></div>
      <p class="modal-hint">Paste a section of an email. The <strong>first line</strong> becomes the event name;
        everything after it is shown when the event is clicked. Leave a blank line between paragraphs.</p>
      <textarea class="paste-box" id="eventPaste" rows="9" placeholder="Winter Club Fair&#10;&#10;Come explore more than 60 clubs..."></textarea>
      <div class="paste-preview" id="eventPreview"></div>
      <p class="form-error" id="eventError" role="alert"></p>
      <button class="btn-primary" id="eventSave">${existing ? 'Save Changes' : 'Add Event'}</button>`,
  });

  const dateBox = body.querySelector('#eventDate');
  const paste = body.querySelector('#eventPaste');
  const error = body.querySelector('#eventError');

  if (existing) {
    dateBox.value = existing.noDate ? '' : existing.dateText;
    paste.value = existing.body ? `${existing.title}\n\n${existing.body}` : existing.title;
  }

  function showDatePreview() {
    const text = dateBox.value.trim();
    const preview = body.querySelector('#datePreview');
    if (!text) { preview.textContent = ''; preview.classList.remove('bad'); return; }
    const date = parseEventDate(text);
    preview.textContent = date.ok ? `Shows as: ${describeEventDate(date)}` : date.error;
    preview.classList.toggle('bad', !date.ok);
  }
  function showNamePreview() {
    const { title } = parseEvent(paste.value);
    body.querySelector('#eventPreview').innerHTML = title ? `Event name: <strong>${esc(title.slice(0, 200))}</strong>` : '';
  }
  dateBox.addEventListener('input', () => { error.textContent = ''; showDatePreview(); });
  paste.addEventListener('input', () => { error.textContent = ''; showNamePreview(); });
  showDatePreview();
  showNamePreview();
  dateBox.focus();

  body.querySelector('#eventSave').addEventListener('click', async () => {
    const date = parseEventDate(dateBox.value);
    const { title, body: details } = parseEvent(paste.value);
    if (!date.ok) { error.textContent = date.error; dateBox.focus(); return; }
    if (!title) { error.textContent = 'Paste the event too. Its first line is the name.'; paste.focus(); return; }
    if (title.length > 200) { error.textContent = 'The first line (the event name) is too long. Keep it under 200 characters.'; return; }

    const { db, firestore } = ctx.fb;
    const data = eventData(title, details, date, firestore);
    body.querySelector('#eventSave').disabled = true;
    try {
      if (existing) {
        await firestore.updateDoc(firestore.doc(db, 'events', existing.id), data);
        closeModal();
        showToast(`Saved "${title}".`);
      } else {
        await firestore.addDoc(firestore.collection(db, 'events'), { ...data, createdAt: firestore.serverTimestamp() });
        closeModal();
        showToast(`Added "${title}".`);
      }
    } catch (e) {
      error.textContent = `Couldn't save the event (${e.code || e.message}).`;
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
  // Undo puts it back exactly as it was
  const restore = {
    title: event.title,
    body: event.body,
    createdAt: firestore.Timestamp.fromDate(event.createdAt),
    ...(event.noDate ? {} : {
      start: firestore.Timestamp.fromDate(event.start),
      end: firestore.Timestamp.fromDate(event.end),
      dateKind: event.kind,
      dateText: event.dateText,
    }),
  };
  showToast(`Deleted "${event.title}".`, {
    action: 'Undo',
    seconds: 8,
    onAction: () => firestore.setDoc(ref, restore)
      .catch((e) => showToast(`Couldn't undo (${e.code || e.message}).`)),
  });
}

// ---------- The section ----------
export const eventsSection = {
  id: 'events',
  label: 'Events',
  icon: ICON_EVENTS,

  mount(el, param, ctx) {
    el.innerHTML = `
      <h2 class="page-title">Events</h2>
      <p class="code-note events-note" id="eventsSampleNote" hidden>These are placeholder events.
        They disappear as soon as an editor adds a real one.</p>
      <div class="section-head">
        <p class="events-intro">Upcoming events first. Click an event for details; scroll down for past events.</p>
        ${ctx.editorMode ? '<button class="btn-add" id="addEventBtn">+ Add Event</button>' : ''}
      </div>
      <ul class="events-list" id="eventsList"><li class="placeholder">Loading events…</li></ul>
      <p class="form-error" id="eventsError" role="alert"></p>
    `;
    if (ctx.editorMode) el.querySelector('#addEventBtn').addEventListener('click', () => openEventEditor(ctx));

    const { db, firestore } = ctx.fb;

    // Live: new and changed events appear without reloading
    return firestore.onSnapshot(firestore.collection(db, 'events'), (snapshot) => {
      const events = snapshot.docs.map(fromDoc);
      if (events.length) draw(el, events, false, ctx);
      else draw(el, placeholders(), true, ctx);
    }, (error) => {
      draw(el, placeholders(), true, ctx);
      el.querySelector('#eventsError').textContent =
        `Couldn't load events (${error.code || error.message}). Showing placeholders.`;
    });
  },
};
