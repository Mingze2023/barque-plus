# Barque+

A website for Bellevue High School's student newspaper, the Barque.

- **Code:** plain HTML, CSS and JavaScript, edited in VS Code or github.dev (press `.` on this page)
- **Website:** published by GitHub Pages
- **Accounts and data:** Firebase (Authentication + Cloud Firestore)

## Files

| File | What it does |
|---|---|
| `index.html` | The page people see (currently the Step 1 setup check) |
| `js/firebase-config.js` | Firebase connection settings, the only place they're set |
| `js/firebase.js` | Connects any page to Firebase |
| `js/setup-check.js` | Step 1 test: saves and reads messages |
| `firestore.rules` | Copy of the database security rules (the real ones live in the Firebase console) |
