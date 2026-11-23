// ============================================================
// Set Profile Types (Step 6): a page only editors can see.
// Type an account's email and its new Profile Type.
// Allowed: student, teacher, club leader. Typing "club leader" shows a
// drop-down of the clubs on the Club Information page (it updates by itself
// as clubs are added) to pick which club they lead.
// Editors themselves are set in the editor list in firestore.rules.
// ============================================================
import { esc } from './util.js';

const ICON_PEOPLE = '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2c2.3.2 3.9 1.7 4.5 4.8"/>';

// What can be typed (any capitalization) -> what gets saved
const ALLOWED_TYPES = {
  student: 'Student',
  teacher: 'Teacher',
  'club leader': 'Club Leader',
  'club leaders': 'Club Leader',
  clubleader: 'Club Leader',
};

export const profileTypesSection = {
  id: 'profile-types',
  label: 'Set Profile Types',
  icon: ICON_PEOPLE,
  editorsOnly: true,   // hidden from everyone except editors

  mount(el, param, ctx) {
    if (!ctx.profile.isEditor) {
      el.innerHTML = '<div class="placeholder">Only editors can use this page.</div>';
      return;
    }

    el.innerHTML = `
      <h2 class="page-title">Set Profile Types</h2>
      <p class="events-intro">Change an account's Profile Type. Allowed: <strong>student</strong>, <strong>teacher</strong> or <strong>club leader</strong>.
        Editors are added in the editor list in <code>firestore.rules</code>.</p>
      <form class="types-form" id="typesForm" novalidate>
        <label class="field">
          <span>Account email</span>
          <input type="email" id="typesEmail" placeholder="someone@bsd405.org" autocomplete="off">
        </label>
        <label class="field">
          <span>New Profile Type</span>
          <input type="text" id="typesType" placeholder="student, teacher or club leader" autocomplete="off">
        </label>
        <label class="field" id="typesClubField" hidden>
          <span>Which club do they lead?</span>
          <select id="typesClub"><option value="">Loading clubs…</option></select>
        </label>
        <p class="form-error" id="typesError" role="alert"></p>
        <p class="form-success" id="typesSuccess" role="status"></p>
        <button type="submit" class="btn-primary" id="typesSubmit">Set Profile Type</button>
      </form>
    `;

    const { db, firestore } = ctx.fb;

    // The club drop-down (shown when "club leader" is typed), kept up to date
    const typeBox = el.querySelector('#typesType');
    const clubField = el.querySelector('#typesClubField');
    const clubSelect = el.querySelector('#typesClub');
    let clubs = [];
    const isLeaderTyped = () => ALLOWED_TYPES[typeBox.value.trim().toLowerCase().replace(/\s+/g, ' ')] === 'Club Leader';
    const drawClubs = () => {
      const chosen = clubSelect.value;
      clubSelect.innerHTML = clubs.length
        ? '<option value="">Pick a club…</option>' + clubs.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')
        : '<option value="">No clubs yet. Add them on the Club Information page.</option>';
      if (clubs.some((c) => c.id === chosen)) clubSelect.value = chosen;
    };
    const stopClubs = firestore.onSnapshot(firestore.collection(db, 'clubs'), (snap) => {
      clubs = snap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      drawClubs();
    }, () => { clubSelect.innerHTML = '<option value="">Couldn\'t load the clubs.</option>'; });
    typeBox.addEventListener('input', () => { clubField.hidden = !isLeaderTyped(); });

    el.querySelector('#typesForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const error = el.querySelector('#typesError');
      const success = el.querySelector('#typesSuccess');
      error.textContent = '';
      success.textContent = '';

      const email = el.querySelector('#typesEmail').value.trim().toLowerCase();
      const typed = el.querySelector('#typesType').value.trim().toLowerCase().replace(/\s+/g, ' ');

      if (!email) { error.textContent = 'Type the email of the account to change.'; return; }
      if (typed === 'editor') { error.textContent = 'Editors are set in the editor list in firestore.rules, not here.'; return; }
      const newType = ALLOWED_TYPES[typed];
      if (!newType) { error.textContent = `"${typed}" isn't a Profile Type. Use "student", "teacher" or "club leader".`; return; }
      const clubId = newType === 'Club Leader' ? clubSelect.value : '';
      if (newType === 'Club Leader' && !clubId) { error.textContent = 'Pick which club they lead.'; return; }
      const clubName = clubId ? (clubs.find((c) => c.id === clubId) || {}).name : '';
      const label = clubId ? `Club Leader of ${clubName}` : newType;

      el.querySelector('#typesSubmit').disabled = true;
      try {
        const found = await firestore.getDocs(firestore.query(
          firestore.collection(db, 'users'),
          firestore.where('email', '==', email),
          firestore.limit(1),
        ));
        if (found.empty) {
          error.textContent = `No account uses ${email}. They need to create an account first.`;
        } else {
          const userDoc = found.docs[0];
          const old = userDoc.data();
          const before = old.profileType === 'Club Leader' && old.clubId
            ? `Club Leader of ${(clubs.find((c) => c.id === old.clubId) || { name: 'a deleted club' }).name}` : old.profileType;
          if (old.profileType === newType && (old.clubId || '') === clubId) {
            success.textContent = `${old.username} is already ${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}.`;
          } else {
            await firestore.updateDoc(userDoc.ref, {
              profileType: newType,
              // only Club Leaders have a club
              clubId: clubId || firestore.deleteField(),
            });
            success.textContent = `Done: ${old.username} changed from ${before} to ${label}. They'll see it the next time they log in or reload.`;
            el.querySelector('#typesEmail').value = '';
            typeBox.value = '';
            clubField.hidden = true;
          }
        }
      } catch (e) {
        error.textContent = `Couldn't change it (${e.code || e.message}). Check that your email is in the editor list and the rules are published.`;
      }
      el.querySelector('#typesSubmit').disabled = false;
    });

    return () => stopClubs();
  },
};
