// ============================================================
// Set Profile Types (Step 6): a page only editors can see.
// Type an account's email and its new Profile Type.
// Allowed for now: student, teacher. ("club leader" comes in Step 16.)
// Editors themselves are set in the editor list in firestore.rules.
// ============================================================


const ICON_PEOPLE = '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2c2.3.2 3.9 1.7 4.5 4.8"/>';

// What can be typed (any capitalization) -> what gets saved
const ALLOWED_TYPES = {
  student: 'Student',
  teacher: 'Teacher',
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
      <p class="events-intro">Change an account's Profile Type. Allowed: <strong>student</strong> or <strong>teacher</strong>.
        Editors are added in the editor list in <code>firestore.rules</code>.</p>
      <form class="types-form" id="typesForm" novalidate>
        <label class="field">
          <span>Account email</span>
          <input type="email" id="typesEmail" placeholder="someone@bsd405.org" autocomplete="off">
        </label>
        <label class="field">
          <span>New Profile Type</span>
          <input type="text" id="typesType" placeholder="student or teacher" autocomplete="off">
        </label>
        <p class="form-error" id="typesError" role="alert"></p>
        <p class="form-success" id="typesSuccess" role="status"></p>
        <button type="submit" class="btn-primary" id="typesSubmit">Set Profile Type</button>
      </form>
    `;

    const { db, firestore } = ctx.fb;

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
      if (typed === 'club leader') { error.textContent = '"club leader" will be added in a later step.'; return; }
      const newType = ALLOWED_TYPES[typed];
      if (!newType) { error.textContent = `"${typed}" isn't a Profile Type. Use "student" or "teacher".`; return; }

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
          const before = userDoc.data().profileType;
          if (before === newType) {
            success.textContent = `${userDoc.data().username} is already a ${newType}.`;
          } else {
            await firestore.updateDoc(userDoc.ref, { profileType: newType });
            success.textContent = `Done: ${userDoc.data().username} changed from ${before} to ${newType}.`;
            el.querySelector('#typesEmail').value = '';
            el.querySelector('#typesType').value = '';
          }
        }
      } catch (e) {
        error.textContent = `Couldn't change it (${e.code || e.message}). Check that your email is in the editor list and the rules are published.`;
      }
      el.querySelector('#typesSubmit').disabled = false;
    });
  },
};
