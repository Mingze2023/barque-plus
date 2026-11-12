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

## If something doesn't work

| Problem | Fix |
|---|---|
| Sidebar says "Could not reach Firebase" | The network is blocking www.gstatic.com. Try another network. |
| Sidebar says "Firebase settings are missing" | Some `PASTE_HERE` is left in `js/firebase-config.js`. |
| "Firebase refused to save your profile" | The Step 3 rules weren't published. Redo step 15. |
| Creating an account gives an error about the sign-in method | Email/Password isn't turned on. Redo step 14. |
| The verification email never arrives | Check the junk folder. School email sometimes holds outside emails. |
| Page didn't change after pushing | Wait a minute, then force-refresh. GitHub Pages takes about a minute to update. |

## Good to know

- The values in `firebase-config.js` are meant to be public. The security rules decide what people can do.
- Only logged-in, verified @bsd405.org accounts can read or save anything in the database.
- Day to day: edit in the VS Code app, preview with Live Preview, then Commit and Push in GitHub Desktop.
