# Tech EW — Weekly Time Sheet

Internal web app where the GIS team logs weekly tasks. Static frontend on GitHub Pages, submissions written to Google Sheets via an Apps Script web app, access gated by a Firebase Google Sign-In allowlist.

- **Live:** https://arsalanmukhtar.github.io/daily_tasks/
- **Repo:** https://github.com/arsalanmukhtar/daily_tasks
- **Firebase project:** `devteam-daily-tasks`
- **Backend:** Apps Script bound to the team spreadsheet (see deployment ID and `BACKEND_VERSION` in [apps-script/Code.gs](apps-script/Code.gs))

---

## Running locally

The site is plain static files — [index.html](index.html), [app.js](app.js), [styles.css](styles.css) — with **no build step**. But you can't just double-click `index.html`: `app.js` loads as an ES module (`type="module"`) and the Firebase modular SDK imports won't run over the `file://` protocol. You need a local HTTP server.

`localhost` is already in the Firebase **Authorized domains** list, so Google Sign-In works locally on any port — no extra setup.

Pick **one** of the options below, then open the printed `http://localhost:…` URL in a browser.

### Option A — Python (ships with Python, nothing to install)

```powershell
cd d:\muhammad_arsalan\daily_tasks
python -m http.server 9000
```

Open http://localhost:8000/

### Option B — Node

```powershell
cd d:\muhammad_arsalan\daily_tasks
npx serve -l 9000
```

`npx` downloads `serve` on first run. Open the URL it prints.

### Option C — VS Code Live Server

Install the **Live Server** extension → right-click `index.html` → **Open with Live Server**.

### Notes

- **Internet is required even locally.** Tailwind, the Firebase SDK, and the Apps Script backend all load/call over the network.
- **There is no separate test backend.** `APPS_SCRIPT_URL` in [app.js](app.js) points at the production Apps Script web app, so anything you submit from localhost writes to the **real `Weekly Submissions` sheet**. Submissions upsert by (email, week), so testing under your own account just overwrites your own row — it won't pollute anyone else's. Delete the test row afterwards if needed.
- **Frontend changes** (`index.html`, `app.js`, `styles.css`) only need a browser refresh — hard-refresh with **Ctrl+Shift+R** to bypass cache. **Backend changes** (`apps-script/Code.gs`) are *not* served locally; they require the Apps Script redeploy in §3.
- Stop the server with **Ctrl+C** in the terminal.

---

## Adding a new team member to the allowlist

There are **four steps**, and the order matters. Skipping any one leaves the system in a confusing half-broken state.

### 1. Edit `app.js` (client allowlist)

Open [app.js](app.js) and add one line inside the `ALLOWLIST` object:

```js
const ALLOWLIST = {
  // ...existing entries...
  'newperson@gmail.com':         'Full Display Name',
};
```

Rules:
- Email **must be lowercase**.
- Mind the trailing comma on the previous line.
- The display name on the right is what shows up in the **Submitting as** block and the spreadsheet's `Name` column.

### 2. Edit `apps-script/Code.gs` (server allowlist)

Paste the **identical** line into the `ALLOWLIST` object in [apps-script/Code.gs](apps-script/Code.gs).

The two copies are not optional duplication — Apps Script can't `import` shared JS, so the server holds its own copy. The server's copy is what actually enforces access; the client's copy only powers the "you're not authorized" UX.

### 3. Redeploy Apps Script (the step everyone forgets)

This is where ~90 minutes can vanish if you skip it or do it wrong.

1. Open the Apps Script editor for the spreadsheet (**Extensions → Apps Script** from the sheet).
2. **Ctrl+A** in the editor → paste the updated `Code.gs` over it → **Ctrl+S** to save.
3. **Deploy → Manage deployments → ✏ pencil** on the active deployment.
4. **Click the Version dropdown** (top of the right panel — it shows "Version N on <date>") and select **"New version"**. *This is the load-bearing step.* Editing the description and clicking Deploy without picking "New version" appears to redeploy but actually pins the existing version — the `/exec` URL keeps serving the old code.
5. Description (optional): e.g. `+ <person's first name>`.
6. Click **Deploy**.

### 4. Push the frontend to GitHub

```powershell
git add app.js apps-script/Code.gs
git commit -m "Add <person's name> to allowlist"
git push
```

GitHub Pages rebuilds in ~30–60 seconds.

---

## Verifying the change is live

After step 3, open this URL in a browser to confirm the new code is actually serving:

```
https://script.google.com/macros/s/AKfycbz6njgCzwRK1i1aXzW9dmlZzlYfexxx72snoSB46L20u4ecitTTTYrLUnrHY_T_rkUmDQ/exec
```

Expected:

```json
{"status":"ok","message":"Tech EW endpoint live","version":"v9-ordered-list-numbering"}
```

If `version` doesn't match the `BACKEND_VERSION` constant in [apps-script/Code.gs](apps-script/Code.gs), the "New version" step in **§3.4** was skipped — redo it.

After step 4, open https://arsalanmukhtar.github.io/daily_tasks/ in an Incognito window (to bypass cached assets) and have the new user sign in. They should pass the auth gate and see the form, then be able to submit a test row that lands in the **Weekly Submissions** sheet.

---

## What breaks if you skip a step

| Skipped step | Symptom |
|---|---|
| 1 — `app.js` edit | New user signs in → client allowlist rejects them → they're signed out with "isn't authorized" message |
| 2 — `Code.gs` edit | New user passes the client check, submits successfully in the UI, but no row appears in the sheet (server rejects the token-bound email) |
| 3 — Apps Script redeploy | Same as #2 — the local `Code.gs` change has no effect until "Deploy → New version" actually publishes it |
| 4 — `git push` | Live site at github.io still serves the old `app.js`, so the new user gets rejected client-side; you've wasted §1 |

---

## Removing a team member

Same four steps in the same order — delete the entry instead of adding it. After step 3 (redeploy) the server stops accepting their submissions immediately; after step 4 (push) the client signs them out the next time they load the page.

If they have past submissions in the **Weekly Submissions** sheet, those rows stay (we never delete data). Their rows just become orphaned — listed under an email no longer in the allowlist, but visible in the sheet for historical record.

---

## Other things in this repo

- [index.html](index.html), [app.js](app.js), [styles.css](styles.css) — the static site served by GitHub Pages.
- [apps-script/Code.gs](apps-script/Code.gs) — the Apps Script backend. The file in this repo is the **source of truth**; the copy inside the Apps Script editor should match. Always edit here first, then paste over.
- Firebase config (apiKey, authDomain, projectId) lives in [app.js](app.js). The web API key is not a secret — Firebase security comes from the Authorized Domains list and the server-side token verification, not from key obscurity.
