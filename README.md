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
| `js/clubs.js` | Club Information: bulletin board, club pages, editor tools |
| `js/club-list.js` | The school's club list (advisor, day, time, room), built in |
| `scripts/scrape_clubs.py` | Re-reads the school's club table every day into `data/clubs.json` |
| `js/misc.js` | Miscellaneous: lunch and breakfast calendars, school map |
| `scripts/scrape_menus.py` | Collects the Health-e Pro lunch and breakfast menus every day into `data/menus.json` |
| `js/qa.js` | Q&A: questions, replies, votes, daily limit, editor tools |
| `js/lost.js` | Lost Items tab at the top of every page |
| `scripts/cleanup_lost_items.py` | Deletes lost items older than 14 days (daily, needs the `FIREBASE_SERVICE_ACCOUNT` secret) |
| `js/poll.js` | Daily Poll link (Microsoft Forms) and the editors' Add Poll button |
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
