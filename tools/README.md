# tools/

One-time and local-only admin scripts for the Firestore migration. None of
these are deployed anywhere or run on a schedule - you run them once from
your own machine and they're done.

## Setup (once)

1. Firebase Console -> gear icon -> **Project settings** -> **Service accounts**
   tab -> **Generate new private key**. Save the downloaded file as
   `tools/service-account.json` (already git-ignored - never commit it).
2. From inside `tools/`, run:
   ```
   npm install
   ```

## seed-allowlist.js

Populates the `allowlist` Firestore collection from the same 14 entries that
used to live in the old (now-retired) Apps Script backend's `ALLOWLIST`.
Safe to re-run (overwrites each doc with the same values, no duplicates).

```
node seed-allowlist.js
```

## import-from-sheets.js

Imports the existing "Weekly Submissions" and "Leave Requests" tabs into
Firestore's `submissions`/`leaveRequests` collections. Safe to re-run
(deterministic doc IDs mean it overwrites, never duplicates).

Requires:
- The Sheets API enabled for this Google Cloud project.
- The Sheet shared with the service account's `client_email` (Viewer or
  Editor, either works - read-only access is all this script uses).

```
node import-from-sheets.js <spreadsheetId>
```

The spreadsheet ID is the long string in the Sheet's URL between `/d/` and
`/edit`. At the end it prints any rows worth a manual look (e.g. very old
rows with no parseable per-day task JSON, imported as a plain-text
best-effort fallback instead of being lost).

## When you're done with a key

Service-account keys are powerful (full admin access to this Firebase
project). Once you've finished the one-time scripts you needed it for,
delete the key from Firebase Console -> Project settings -> Service accounts
-> Manage service account permissions -> find the key -> delete it, and
remove the local `tools/service-account.json` file. Generate a fresh,
separate key later for the VM push daemon rather than reusing this one.
