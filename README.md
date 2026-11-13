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
| `js/events.js` | Events section: list of events, popups, placeholders |
| `js/modal.js` | The popup window any section can use |
| `js/util.js` | Small shared helpers (safe text, dates, paragraphs) |
| `js/account.js` | Log In, Create Account, Forgot Password, email verification, profiles |
| `auth-action.html` + `js/auth-action.js` | The page that opens from links in Barque+ emails |
| `js/firebase-config.js` | Firebase connection settings, the only place they're set |
| `js/firebase.js` | Connects any page to Firebase |
| `data/news.json` | The scraped articles (updated automatically every day) |
| `scripts/scrape_news.py` | The news scraper (runs on GitHub, not on your computer) |
| `.github/workflows/scrape-and-publish.yml` | Tells GitHub to scrape daily and publish the site |
| `firestore.rules` | Copy of the database security rules (the real ones live in the Firebase console) |
