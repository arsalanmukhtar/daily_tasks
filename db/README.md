# db/

`schema.sql` is the source of truth for the Postgres schema `server/`
reads and writes - see `PROJECT.md` for the collections it replaces.

## migrate-from-firestore.js

One-time script, run locally, that copies every Firestore collection into
this schema. Uses the same `service-account.json` convention as
`tools/README.md` - follow those setup steps, saving the key as
`db/service-account.json` instead of `tools/service-account.json`.

```
cd db
npm install
cp .env.example .env   # fill in DB_* - see the comments in that file
node migrate-from-firestore.js
```

Safe to re-run against the same target: every table is upserted by its
natural key, so running it twice overwrites rows instead of duplicating
them. Rehearse it first against a throwaway database (a fresh `CREATE
DATABASE` + `psql -f schema.sql`, same as any real setup) - spot-check row
counts against the Firestore console, then run it again to confirm nothing
duplicates - before ever pointing `.env` at the real target database.

See the comment at the top of `migrate-from-firestore.js` for the one known
limitation (old leave-request attachments keep their original Google Drive
URLs rather than being copied to the VM's disk).
