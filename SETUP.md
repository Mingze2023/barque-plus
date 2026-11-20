# Barque+ setup (no terminal needed)

Works from a school Windows computer or a Mac. Takes about 20 minutes.
Button names on GitHub and Firebase sometimes change slightly; look for the closest match.

## Part A: GitHub (stores the code and publishes the website)

1. **Make an account.** Go to github.com and click **Sign up**. Use a personal email. Your username becomes part of the website link.
2. **Create the repository.** Click **+** (top right), then **New repository**.
   - Repository name: `barque-plus`
   - Choose **Public**
   - Check **Add a README file**
   - Click **Create repository**
3. **Upload the starter files.** Unzip `barque-plus-step1.zip`. On your repository page, click **Add file**, then **Upload files**. Open the unzipped `barque-plus` folder and drag **everything inside it** onto the page: `index.html`, `README.md`, `SETUP.md`, `firestore.rules`, and the `js` folder. Scroll down and click **Commit changes**.
4. **Turn on the website.** Click the **Settings** tab, then **Pages** in the left menu.
   - Under **Source**, choose **Deploy from a branch**
   - Under **Branch**, choose **main** and **/ (root)**, then click **Save**
   - Wait 1 to 2 minutes and refresh. The page shows "Your site is live at `https://YOUR-USERNAME.github.io/barque-plus/`".
5. **Open that link.** The page will say Firebase settings are missing until you finish Part C. That's expected.

## Part B: Firebase (accounts and the database)

6. **Create the project.** Go to console.firebase.google.com and sign in with a **personal** Google account. Click **Create a project** (or **Get started**).
   - Name: `barque-plus`
   - If it asks about Gemini or AI assistance, either choice is fine
   - Turn **Google Analytics off** (not needed)
   - Click **Create project**, then **Continue**
7. **Register the website.** On the project's home page, click the **web icon `</>`** (or **+ Add app**, then **Web**).
   - Nickname: `Barque+ website`
   - Leave **Firebase Hosting unchecked**
   - Click **Register app**
   - It shows code containing `const firebaseConfig = { apiKey: "...", ... }`. Keep this tab open. (You can find it again later: gear icon, then **Project settings**, then **Your apps**.)
8. **Create the database.** In the left menu, open **Build** (or **Databases & Storage**), then **Firestore Database**, then click **Create database**.
   - If asked for an edition, choose **Standard**
   - Leave the database ID as `(default)`
   - Location: **nam5 (United States)**. This can't be changed later.
   - Choose **Start in production mode**
   - Click **Create**
9. **Set the security rules.** In Firestore, click the **Rules** tab. Delete everything in the box. On GitHub, open `firestore.rules`, click the **Copy raw file** button, paste it into the Rules box, and click **Publish**.

## Part C: Connect the website to Firebase

10. **Open the code editor.** On your GitHub repository page, press the **`.`** (period) key. This opens github.dev, which is VS Code in your browser.
11. **Paste your settings.** Open `js/firebase-config.js`. Replace each `PASTE_HERE` with the matching value from step 7. Keep the quotation marks and commas.
12. **Save to GitHub.** Click the **Source Control** icon on the left (it shows a "1"). Type a message like `Add Firebase settings` and click **Commit & Push**.
13. **Wait about a minute**, then open your github.io link. With Step 3 in place, you should see the Barque+ login sidebar.

## Part D: Accounts (Step 3)

14. **Turn on email and password logins.** In the Firebase console, open **Authentication** (under **Build** or **Security** in the left menu). Click **Get started** if it's your first time. On the **Sign-in method** tab, click **Email/Password**, turn on the **first** switch only (leave "Email link" off), and click **Save**.
15. **Publish the new rules.** Open **Firestore Database → Rules**, replace everything with the contents of `firestore.rules`, and click **Publish**.
16. **Allow your website.** In **Authentication → Settings → Authorized domains**, click **Add domain** and type `YOUR-USERNAME.github.io`.
17. **Send email links to your own page.** In **Authentication → Templates**, open **Email address verification** and click the **pencil** icon. At the bottom, click **Customize action URL** and type
    `https://YOUR-USERNAME.github.io/barque-plus/auth-action.html`
    then click **Save**. This applies to the password reset email too. While you're there, you can set the **Sender name** to `Barque+`.

## Part E: News (Step 4)

18. **Let GitHub Actions publish the site.** On GitHub, open **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**. (Do this before pushing the Step 4 files.)
19. **Publish the new rules.** Firestore Database → Rules → paste `firestore.rules` → **Publish**.
20. **Push the Step 4 files** with GitHub Desktop. The **Actions** tab on GitHub shows a run called "Scrape news and publish site". When it has a green check, the site is updated.
21. **Get the real news.** Actions tab → **Scrape news and publish site** (left list) → **Run workflow** → **Run workflow**. After a few minutes, the sample articles are replaced with the Barque's articles. From then on it runs by itself every morning.
22. **Pull the new news** in GitHub Desktop (**Fetch origin**, then **Pull origin**) before your next commit, since GitHub saved a new `data/news.json`.

## Part F: Events (Step 5)

23. **Publish the new rules** (Firestore Database → Rules → paste `firestore.rules` → **Publish**).
24. **Add events** from the website: turn on **Editor Mode** (Step 6), open Events, and click **+ Add Event**. Type the date (`11/20`, `11/14-11/20`, `now-11/20`, or a month like `November`), then paste the email section. Use the pencil to change an event later.

## Part G: Editors (Step 6)

25. **Add the editors.** Open `firestore.rules` and find the **EDITOR LIST** section near the top. Put the emails inside the brackets, in lowercase and in quotes, separated by commas:
    `return ['mingze@bsd405.org', 'someone@bsd405.org'];`
26. **Publish the rules** (Firestore Database → Rules → paste the whole file → **Publish**). Whenever you add or remove an editor, edit this section and publish again. The file in your project is your record of it; the Firebase console is what counts.
27. **Log out and back in** with an editor account. The Profile Type shows **Editor**, an **Editor Mode** switch appears in the right sidebar, and **Set Profile Types** appears in the menu.

## Part H: Student Art (Step 7)

28. **Publish the new rules** (Firestore Database → Rules → paste `firestore.rules` → **Publish**). The editor list already includes `s-shimi@bsd405.org`.
29. **Add art** in Editor Mode: Student Art → **+ Add Art** → choose Picture, Text, Video or Audio.
    - Pictures are shrunk automatically. iPhone HEIC photos must be exported as JPG first.
    - Google Drive videos and audio must be shared as **"Anyone with the link"**, or they won't play for others.

## Part I: Club Information (Step 8)

30. **Publish the new rules** (Firestore Database → Rules → paste `firestore.rules` → **Publish**).
31. **Add the school's clubs** in Editor Mode: Club Information → **Add Clubs from School Website** → **Add Clubs**. This adds every club from the school's ASB club table, each with its advisor, meeting day, time and room. Use **+ Add Club** for any club that isn't on that list.
32. Open a club and click **Edit Club** to change its advisor, meeting day, time or room, or to add its information, news and picture.
33. The daily GitHub Action re-reads the school's club table into `data/clubs.json`. Clicking **Add Clubs from School Website** again later offers only clubs that aren't on the board yet (it never changes or re-adds clubs you've edited or deleted).

## Part J: Schedules/Map (Step 9, called Miscellaneous in the spec)

34. **Publish the new rules** (Firestore Database → Rules → paste `firestore.rules` → **Publish**). They add the school map.
35. **Collect the menus now** instead of waiting for tomorrow morning: GitHub → **Actions** → **Scrape news and publish site** → **Run workflow**. When it finishes, the step "Read the lunch and breakfast menus" should list the months it found, and `data/menus.json` appears in the repository.
36. **Upload the map** in Editor Mode: Schedules/Map → click the empty map box → choose the picture. Click the map again any time to replace it (Undo is offered for 10 seconds).

**Bell schedules (on the Schedules/Map page):** nothing to set up. They're built in, and the daily GitHub Action re-reads the school's bell schedule page into `data/bells.json`, so changes on the school website show up the next day.

## Part K: Q&A (Step 10)

37. **Publish the new rules** (Firestore Database → Rules → paste `firestore.rules` → **Publish**). They add Q&A and the daily limit. If Publish shows an error, copy the message (it names a line number).
38. That's it: Q&A appears in the menu. Students can post 5 questions and replies per day in total (it resets at midnight, Bellevue time). Editors have no limit, and in Editor Mode every question and reply has a trash bin with Undo.

## Part L: Lost Items (Step 11)

39. **Publish the new rules** (Firestore Database → Rules → paste `firestore.rules` → **Publish**).
40. **Let the daily GitHub Action delete old lost items.** The website already hides entries older than 14 days; this step deletes them from Firestore for good. It needs a key that lets GitHub sign in to your Firebase project, kept as a GitHub *secret* (stored encrypted; nobody can see it, not even on the public repository).
    1. Firebase console → gear icon ⚙ next to **Project Overview** → **Project settings** → **Service accounts** tab.
    2. Click **Generate new private key** → **Generate key**. A `.json` file downloads.
    3. Open that file in VS Code (or Notepad / TextEdit) and copy **everything** in it, from the first `{` to the last `}`.
    4. On GitHub, open the barque-plus repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
    5. Name: `FIREBASE_SERVICE_ACCOUNT`. Secret: paste. Click **Add secret**.
    6. **Delete the downloaded `.json` file** (and empty the Trash / Recycle Bin). Never put it in the project folder or commit it: anyone with it can change everything in your database.
    7. Test it: **Actions** → **Scrape news and publish site** → **Run workflow**. The step "Delete lost items older than 14 days" should say `Deleted 0 lost item(s)…` (or more).
    If the key is ever shared by mistake: Service accounts → **Manage service account permissions** → find the key and delete it, then make a new one.

## Part M: Daily Poll (Step 12)

41. **Publish the new rules** (Firestore Database → Rules → paste `firestore.rules` → **Publish**).
42. **Add a poll** in Editor Mode: click **Add Poll** under the Lost Items tab (on any page), paste the Microsoft Forms link (in Forms: **Collect responses** → **Copy link**; make sure it's set so people at your school can respond), and type the name. Adding another poll replaces it; **Remove Poll** takes it down.

**Email verification switch:** email verification is currently turned **on** (`REQUIRE_EMAIL_VERIFICATION` in `js/account.js` and `verificationRequired()` in `firestore.rules`). To turn it off (for example, if school email stops receiving the emails), set both to `false` and publish the rules.

## If something doesn't work

| Problem | Fix |
|---|---|
| Sidebar says "Could not reach Firebase" | The network is blocking www.gstatic.com. Try another network. |
| Sidebar says "Firebase settings are missing" | Some `PASTE_HERE` is left in `js/firebase-config.js`. |
| "Firebase refused to save your profile" | The Step 3 rules weren't published. Redo step 15. |
| Creating an account gives an error about the sign-in method | Email/Password isn't turned on. Redo step 14. |
| The verification email never arrives | Check the junk folder. School email sometimes holds outside emails. |
| Page didn't change after pushing | Check the Actions tab: wait for the green check, then force-refresh. |
| Actions run has a red X at "Scrape the Barque's news" | Click it to see the log. The scraper prints what it found and what failed. |
| Actions run has a red X at "Publish to GitHub Pages" | Settings → Pages → Source must be **GitHub Actions** (step 18). |
| Votes or comments say "permission-denied" | The Step 4 rules weren't published. Redo step 19. |

## Good to know

- The values in `firebase-config.js` are meant to be public. The security rules decide what people can do.
- Only logged-in, verified @bsd405.org accounts can read or save anything in the database.
- Day to day: edit in the VS Code app, preview with Live Preview, then Commit and Push in GitHub Desktop.
