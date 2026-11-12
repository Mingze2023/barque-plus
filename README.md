# Barque+

A website for Bellevue High School's student newspaper, the Barque.

- **Code:** plain HTML, CSS and JavaScript, edited in VS Code or github.dev (press `.` on this page)
- **Website:** published by GitHub Pages
- **Accounts and data:** Firebase (Authentication + Cloud Firestore)

## Files

| File | What it does |
|---|---|
| `index.html` | The main page: layout with both sidebars |
| `css/style.css` | All colors, fonts and layout |
| `js/app.js` | Sidebars, sections menu, profile icon, startup |
| `js/account.js` | Log In, Create Account, Forgot Password, email verification, profiles |
| `auth-action.html` + `js/auth-action.js` | The page that opens from links in Barque+ emails |
| `js/firebase-config.js` | Firebase connection settings, the only place they're set |
| `js/firebase.js` | Connects any page to Firebase |
| `firestore.rules` | Copy of the database security rules (the real ones live in the Firebase console) |
