# Tech EW - Weekly Time Sheet

Internal web app where the GIS team logs weekly tasks and applies for leave. Static frontend on GitHub Pages, a native Android "Leave Approvals" app for the manager, all talking directly to **Firebase Firestore** - no backend server, no Cloud Functions. Access is gated by Firebase Google Sign-In plus a Firestore `allowlist` collection; authorization is enforced entirely by `firestore.rules`.

- **Live:** https://arsalanmukhtar.github.io/daily_tasks/
- **Repo:** https://github.com/arsalanmukhtar/daily_tasks
- **Firebase project:** `devteam-daily-tasks`
- **Datastore:** Firestore, read/written directly by the client SDK (web + Android) - see [firestore.rules](firestore.rules), the sole authorization layer
- **Attachments:** leave-request files upload straight to the requester's own Google Drive via client-side OAuth (`drive.file` scope) - no Firebase Storage, no billing plan required
- **Push notifications:** a small Node.js daemon in [push-daemon/](push-daemon/) runs on our own VM, listens to Firestore directly, and sends FCM pushes to the manager's Android app

---

## Running locally

The site is plain static files - [index.html](index.html), [app.js](app.js), [styles.css](styles.css) - with **no build step**. But you can't just double-click `index.html`: `app.js` loads as an ES module (`type="module"`) and the Firebase modular SDK imports won't run over the `file://` protocol. You need a local HTTP server.

`localhost` is already in the Firebase **Authorized domains** list, so Google Sign-In works locally on any port - no extra setup.

Pick **one** of the options below, then open the printed `http://localhost:…` URL in a browser.

### Option A - Python (ships with Python, nothing to install)

```powershell
cd d:\muhammad_arsalan\daily_tasks
python -m http.server 9000
```

Open http://localhost:9000/

### Option B - Node

```powershell
cd d:\muhammad_arsalan\daily_tasks
npx serve -l 9000
```

`npx` downloads `serve` on first run. Open the URL it prints.

### Option C - VS Code Live Server

Install the **Live Server** extension → right-click `index.html` → **Open with Live Server**.

### Notes

- **Internet is required even locally.** Tailwind, the Firebase SDK, and Firestore itself all load/call over the network.
- **There is no separate test project.** Everything you submit from localhost writes to the **real** Firestore database - submissions upsert by `(email, week)` doc ID, so testing under your own account just overwrites your own row, and leave requests land as real (deletable) documents.
- **Frontend changes** (`index.html`, `app.js`, `styles.css`) only need a browser refresh - hard-refresh with **Ctrl+Shift+R** to bypass cache. There is no backend to redeploy for data-model changes - `firestore.rules` changes are published by pasting into the Firebase Console's **Rules** tab (Firestore Database → Rules), not via CLI or git push.
- Stop the server with **Ctrl+C** in the terminal.

---

## Adding or removing a team member

Everything about a person - name, designation, who they report to, whether they're an owner/manager, and whether their access is active - lives in one Firestore document: `allowlist/{email-lowercased}`.

1. Open **Firebase Console → Firestore Database → allowlist**.
2. To add someone: create a new document with ID = their lowercase email, and fields `name`, `designation`, `reportedTo`, `domain`, `isOwner` (bool), `active` (bool, set `true`).
3. To remove someone: either delete their document, or set `active: false` to revoke access while keeping the record (their past submissions/leave requests are untouched either way - we never delete historical data).

That's it - no code edit, no redeploy, no `git push`. The change takes effect on their next sign-in (`firestore.rules` reads this same document to decide every permission).

`tools/seed-allowlist.js` is the one-time script that originally populated this collection from the old Apps Script `ALLOWLIST` object - see [tools/README.md](tools/README.md).

---

## Repo layout

- [index.html](index.html), [app.js](app.js), [styles.css](styles.css) - the static site served by GitHub Pages. Firebase config (apiKey, authDomain, projectId) lives in `app.js`; the web API key is not a secret - Firebase security comes from Authorized Domains + Firestore Security Rules, not key obscurity.
- [firestore.rules](firestore.rules) - the **only** authorization layer for both apps. Source of truth lives in this repo; publish changes by pasting into Firebase Console → Firestore Database → Rules.
- [android-app/](android-app/) - native Android app for the manager ("Leave Approvals"): live Firestore listeners for the Requests/Summary tabs, Firestore transactions for approve/reject, FCM for push.
- [push-daemon/](push-daemon/) - long-running Node.js service on our VM that watches Firestore for new leave requests and sends the FCM push (see its own README for deployment).
- [tools/](tools/) - one-time/local-only admin scripts (allowlist seeding, the historical Sheets→Firestore import). Not deployed anywhere - see [tools/README.md](tools/README.md).
- [assets/](assets/) - icons and logo used by the web app.
- [.well-known/assetlinks.json](.well-known/assetlinks.json) - Digital Asset Links file verifying the Android app's link to this domain.
