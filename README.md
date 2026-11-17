# Barque+

A website for Bellevue High School's student newspaper, the Barque.

- **Code:** plain HTML, CSS and JavaScript, edited in VS Code or github.dev (press `.` on this page)
- **Website:** published by GitHub Pages (through GitHub Actions)
- **Accounts and data:** Firebase (Authentication + Cloud Firestore)

## Files

| File | What it does |
|---|---|
| `index.html` | The main page: layout with both sidebars |
| `css/style.css` | All colors, fonts and layout |
| `js/app.js` | Sidebars, sections menu, profile icon, startup |
| `js/news.js` | News section: list, search, sort, votes, views, articles, comments |
| `js/events.js` | Events section: list of events, popups, placeholders, editor tools |
| `js/event-dates.js` | Reads typed event dates (11/20, 11/14-11/20, now-11/20, November) |
| `js/art.js` | Student Art section: full-page pieces, ••• background text, editor tools |
| `js/images.js` | Shrinks pictures so they fit in Firestore (used by Student Art, later Clubs and the map) |
| `js/embeds.js` | Turns YouTube / Vimeo / Google Drive / SoundCloud / file links into players |
| `js/profile-types.js` | Set Profile Types page (editors only) |
| `js/theme.js` | Season themes (Settings → Spring, Summer, Fall, Winter); colors are in `css/style.css` |
| `js/toast.js` | Small message at the bottom of the screen, with Undo |
| `js/modal.js` | The popup window any section can use |
| `js/util.js` | Small shared helpers (safe text, dates, paragraphs) |
| `js/account.js` | Log In, Create Account, Forgot Password, email verification, profiles |
| `auth-action.html` + `js/auth-action.js` | The page that opens from links in Barque+ emails |
| `js/firebase-config.js` | Firebase connection settings, the only place they're set |
| `js/firebase.js` | Connects any page to Firebase |
| `data/news.json` | The scraped articles (updated automatically every day) |
| `scripts/scrape_news.py` | The news scraper (runs on GitHub, not on your computer) |
| `.github/workflows/scrape-and-publish.yml` | Tells GitHub to scrape daily and publish the site |
| `firestore.rules` | Copy of the database security rules (the real ones live in the Firebase console). **The editor list is at the top.** |
