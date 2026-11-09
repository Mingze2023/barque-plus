# Barque+ Step 1 setup (no terminal needed)

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
5. **Open that link.** You should see the Barque+ checklist. The first two checks are green and "Firebase settings filled in" is red. That's expected.

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
13. **Test it.** Wait about a minute, then open your github.io link and force-refresh (Ctrl+F5 on Windows, Cmd+Shift+R on Mac). Type a message and click **Save**. When all five checks are green, Step 1 is done.

## If a check is red

| Red check | Fix |
|---|---|
| Firebase code downloaded | The network is blocking www.gstatic.com. Try another network. |
| Firebase settings filled in | Some `PASTE_HERE` is left in `js/firebase-config.js`, or the change wasn't committed yet. |
| Database can be read / can save: "permission denied" | The rules weren't published. Redo step 9. |
| Database can be read: "No database found" | Redo step 8. |
| Database can be read: "Could not reach the database" | The network is blocking firestore.googleapis.com. |
| Page didn't change after editing | Wait a minute, then force-refresh. GitHub Pages takes about a minute to update. |

## Good to know

- The values in `firebase-config.js` are meant to be public. The security rules decide what people can do.
- Until Step 3 adds logins, anyone with the link can post short test messages. Step 3 removes the test page and locks everything behind school accounts.
- Every later step works the same way: edit in github.dev, Commit & Push, then refresh the github.io link.
